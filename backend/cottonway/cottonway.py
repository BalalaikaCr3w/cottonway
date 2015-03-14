from twisted.internet.defer import inlineCallbacks, returnValue

from autobahn import wamp
from autobahn.twisted.wamp import ApplicationSession
#from autobahn.wamp.exception import ApplicationError

import txmongo

from bson import ObjectId

from datetime import datetime

import traceback

from twisted.python import randbytes

from base64 import b64encode, b64decode


def result(*args, **kwargs):
    if len(args) != 0: kwargs['callStatus'] = args[0]
    else: kwargs['callStatus'] = 0
        
    return kwargs

def returnMessage(message, isNew):
    return {'id': str(message['_id']), 'roomId': str(message['roomId']),
            'sender': str(message['sender']), 'text': message['text'],
            'time': message['time'].isoformat(), 'new': isNew}

def returnRoom(room, userId):
    r = {'id': str(room['_id']),
         'peerIds': map(lambda i: str(i), filter(lambda i: i != userId, room['userIds']))}
    
    if 'title' in room: r['title'] = room['title']
    
    if 'isPrivate' in room: r['isPrivate'] = room['isPrivate']
    else: r['isPrivate'] = False

    return r


class AppSession(ApplicationSession):
    @inlineCallbacks
    def onJoin(self, details):
        self.random = randbytes.RandomFactory()._osUrandom
        
        mongo = yield txmongo.MongoConnection()
        self.db = mongo.cottonway
        yield self.db.sessions.drop()
        mainRoom = yield self.db.rooms.find_one({'main': True})
        if '_id' not in mainRoom:
            yield self.db.rooms.insert({'main': True, "title" : "Cotton Way club"})
        
        yield self.subscribe(self, options=wamp.types.SubscribeOptions(details_arg='details'))
        yield self.register(self, options=wamp.types.RegisterOptions(details_arg='details'))

    @wamp.subscribe(u'wamp.session.on_leave')
    def onMetaLeave(self, sessionId, details):
        try:
            self.db.sessions.remove({'wampSessionId': sessionId})
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.subscribe(u'club.cottonway.chat.on_messages_were_read')
    def onMessagesWereRead(self, messageIds, details):
        try:
            print('club.cottonway.chat.messages-were-read')
            print(details)
            session = yield self.db.sessions.find_one({'wampSessionId': details.publisher})
            self.db.newMessages.remove({'userId': session['userId'],
                                        'messageId': {'$in': map(lambda i: ObjectId(i), messageIds)}})
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @inlineCallbacks
    def doSignIn(self, user, details):
        yield self.db.sessions.insert({'wampSessionId': details.caller, 'userId': user['_id']})
        returnValue(result(user={'id': str(user['_id']), 'name': user['name']}))

    @inlineCallbacks
    def doSignInAndSave(self, user, details):
        authData = b64encode(self.random(32))
        r = yield self.doSignIn(user, details)
        yield self.db.authdata.insert({'userId': user['_id'], 'authData': authData})
        r['authData'] = authData
        returnValue(r)

    @wamp.register(u'club.cottonway.auth.sign_up')
    @inlineCallbacks
    def signUp(self, email, name, password, details):
        try:
            user = yield self.db.users.find_one({'$or': [{'name': name}, {'email': email}]})
            if '_id' in user: returnValue(result(1))
            
            userId = yield self.db.users.insert({'email': email, 'name': name, 'password': password})
            user = yield self.db.users.find_one({'_id': userId})
            
            yield self.db.rooms.update({'main': True}, {'$push': {'userIds': userId}})

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.auth.sign_in')
    @inlineCallbacks
    def signIn(self, email, password, details):
        try:
            user = yield self.db.users.find_one({'email': email})
            if '_id' not in user: returnValue(result(1))
                
            if password != user['password']: returnValue(result(1))

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.auth.send_auth_data')
    @inlineCallbacks
    def sendAuthData(self, authData, details):
        try:
            authResult = yield self.db.authdata.find_one({'authData': authData})
            if '_id' not in authResult: returnValue(result(1))

            user = yield self.db.users.find_one({'_id': authResult['userId']})
            if '_id' not in user: returnValue(result(1))

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.chat.peers')
    @inlineCallbacks
    def peers(self, peerIds, details):
        try:
            session= yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session:
                returnValue(False)
                
            users = yield self.db.users.find({'_id': {'$in': map(lambda i: ObjectId(i), peerIds)}})
            returnValue(map(lambda u: {'id': str(u['_id']), 'name': u['name']}, users))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.chat.rooms')
    @inlineCallbacks
    def rooms(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session:
                returnValue(False)
                
            rooms = yield self.db.rooms.find({'userIds': session['userId']})
            returnValue(map(lambda r: returnRoom(r, session['userId']), rooms))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    # support only private rooms now
    @wamp.register(u'club.cottonway.chat.start_room')
    @inlineCallbacks
    def startRoom(self, peerIds, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(False)

            if len(peerIds) != 1: returnValue(False)

            peer = yield self.db.users.find_one({'_id': ObjectId(peerIds[0])})
            if '_id' not in peer: returnValue(False)

            currentRooms = yield self.db.rooms.find({'isPrivate': True, 'userIds': {'$all': [peer['_id'], session['userId']]}})
            if len(currentRooms) != 0: returnValue(False)
            
            roomId = yield self.db.rooms.insert({'isPrivate': True, 'userIds': [peer['_id'], session['userId']]})
            room = yield self.db.rooms.find_one({'_id': roomId})

            peerSession = yield self.db.sessions.find_one({'userId': peer['_id']})
            if '_id' in peerSession:
                self.publish('club.cottonway.chat.on_new_room', returnRoom(room, peerSession['userId']),
                             options=wamp.types.PublishOptions(eligible=[peerSession['wampSessionId']]))

            returnValue(returnRoom(room, session['userId']))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.chat.messages')
    @inlineCallbacks
    def messages(self, roomId, messageIds, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session:
                returnValue(False)

            req = dict()

            if roomId is not None:
                req['roomId'] = ObjectId(roomId)

            if messageIds is not None:
                req['_id'] = {'$in': map(lambda i: ObjectId(i), messageIds)}
                
            messages = yield self.db.messages.find(req)
                
            roomIds = set(map(lambda m: m['roomId'], messages))
            userRooms = yield self.db.rooms.find({'_id': {'$in': list(roomIds)},
                                                  'userIds': session['userId']})
            if len(roomIds) != len(userRooms):
                return

            newMessages = yield self.db.newMessages.find({'messageId': {'$in': map(lambda m: m['_id'], messages)}})
            newMessages = set(map(lambda m: m['messageId'], newMessages))

            returnValue(map(lambda m: returnMessage(m, m['_id'] in newMessages), messages))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise

    @wamp.register(u'club.cottonway.chat.send_message')
    @inlineCallbacks
    def sendMessage(self, roomId, text, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session:
                returnValue(False)
                                                      
            room = yield self.db.rooms.find_one({'_id': ObjectId(roomId)})
            messageId = yield self.db.messages.insert({'roomId': ObjectId(roomId), 'sender': session['userId'], 'text': text, 'time': datetime.utcnow()})
            peerIds = filter(lambda i: i != session['userId'], room['userIds'])
            newMessages = map(lambda i: {'userId': i, 'messageId': messageId}, peerIds)

            yield self.db.newMessages.insert(newMessages)
            message = yield self.db.messages.find_one({'_id': messageId})
            
            peerSessions = yield self.db.sessions.find({'userId': {'$in': peerIds}})
            peerSessionIds = map(lambda s: s['wampSessionId'], peerSessions)
            if len(peerSessionIds) != 0:
                self.publish('club.cottonway.chat.on_new_message', returnMessage(message, True),
                             options=wamp.types.PublishOptions(eligible=peerSessionIds))
            
            returnValue(returnMessage(message, False))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            raise
