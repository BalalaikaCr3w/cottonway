from twisted.internet.defer import inlineCallbacks, returnValue

from autobahn import wamp
from autobahn.twisted.wamp import ApplicationSession

import txmongo

from bson import ObjectId

from datetime import datetime, timedelta

import traceback

from twisted.python import randbytes

from base64 import b64encode, b64decode

from enum import IntEnum

import string


class Error(IntEnum):
    ok = 0
    error = 1
    wrongEmail = 2
    wrongName = 3
    wrongPassword = 4
    wrongCredentials = 5
    notAuthenticated = 6
    wrongParameters = 7
    roomAlreadyExists = 8
    wrongFlag = 9
    alreadySolved = 10


allowedName = set(unicode(string.letters + string.ascii_uppercase + string.digits + '_'))

def checkKeys(src, keys):
    for k in keys:
        if k not in src:
            return False
    return True

def copyDict(src, keys):
    r = {}
    for k in keys:
        if k in src:
            r[k] = src[k]
    return r

def result(*args, **kwargs):
    if len(args) != 0: kwargs['callStatus'] = int(args[0])
    else: kwargs['callStatus'] = int(Error.ok)
        
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

def returnPeer(user):
    return {'id': str(user['_id']), 'name': user['name']}

def returnUser(user):
    r = returnPeer(user)
    r.update(copyDict(user, ['email', 'isAdmin', 'score']))
    return r

def returnTask(task, isSolved):
    r = {'id': str(task['_id']), 'isSolved': isSolved}
    r.update(copyDict(task, ['title', 'shortDesc', 'desc', 'categories', 'price']))
    return r

def returnStep(step, time):
    return {'id': str(step['_id']), 'desc': step['desc'], 'time': time.isoformat()}

def returnAdminStep(step):
    r = {'id': str(step['_id'])}
    r.update(copyDict(step, ['desc', 'prev', 'isActive']))
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
            yield self.db.rooms.insert({'main': True, 'title' : 'Cotton Way club', 'userIds': []})
        
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
        returnValue(result(user=returnUser(user)))

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
            if type(email) is not unicode or len(email) == 0 or '@' not in email:
                returnValue(result(Error.wrongEmail))

            if type(name) is not unicode or len(name) == 0 or not set(name).issubset(allowedName):
                returnValue(result(Error.wrongName))

            if type(password) is not unicode or len(password) == 0:
                returnValue(result(Error.wrongPassword))

            # TODO: set only first step, it's here for debug now
            steps = yield self.db.steps.find()
            stepsDict = dict(zip(map(lambda s: s['prev'], steps), steps))
            stepMoments = []
            now = datetime.utcnow()
            step = stepsDict[None]
            while step['_id'] in stepsDict and step['isActive']:
                stepMoments.append({'stepId': step['_id'], 'time': now})
                now += timedelta(hours=1)
                step = stepsDict[step['_id']]

            user = yield self.db.users.find_one({'$or': [{'name': name}, {'email': email}]})
            if '_id' in user: returnValue(result(Error.error))

            userId = yield self.db.users.insert({'email': email, 'name': name, 'password': password,
                                                 'isAdmin': False, 'version': 0, 'score': 0,
                                                 'solvedTaskIds': [], 'stepMoments': stepMoments})
            user = yield self.db.users.find_one({'_id': userId})

            room = yield self.db.rooms.find_one({'main': True})
            yield self.db.rooms.update({'main': True}, {'$push': {'userIds': userId}})

            peerSessions = yield self.db.sessions.find({'userId': {'$in': room['userIds']}})
            peerSessionIds = map(lambda s: s['wampSessionId'], peerSessions)
            if len(peerSessions) != 0:
                self.publish('club.cottonway.chat.on_new_peer', {'roomId': str(room['_id']), 'peer': returnPeer(user)},
                             options=wamp.types.PublishOptions(eligible=peerSessionIds))

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.auth.sign_in')
    @inlineCallbacks
    def signIn(self, email, password, details):
        try:
            user = yield self.db.users.find_one({'email': email})
            if '_id' not in user: returnValue(result(Error.error))
                
            if password != user['password']: returnValue(result(Error.wrongCredentials))

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.auth.send_auth_data')
    @inlineCallbacks
    def sendAuthData(self, authData, details):
        try:
            authResult = yield self.db.authdata.find_one({'authData': authData})
            if '_id' not in authResult: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': authResult['userId']})
            if '_id' not in user: returnValue(result(Error.error))

            r = yield self.doSignInAndSave(user, details)
            returnValue(r)
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.chat.peers')
    @inlineCallbacks
    def peers(self, peerIds, details):
        try:
            session= yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))
                
            users = yield self.db.users.find({'_id': {'$in': map(lambda i: ObjectId(i), peerIds)}})
            returnValue(result(peers=map(lambda u: returnPeer(u), users)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.chat.rooms')
    @inlineCallbacks
    def rooms(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))
                
            rooms = yield self.db.rooms.find({'userIds': session['userId']})
            returnValue(result(rooms=map(lambda r: returnRoom(r, session['userId']), rooms)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    # support only private rooms now
    @wamp.register(u'club.cottonway.chat.start_room')
    @inlineCallbacks
    def startRoom(self, peerIds, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            if len(peerIds) != 1: returnValue(result(Error.wrongParameters))

            peer = yield self.db.users.find_one({'_id': ObjectId(peerIds[0])})
            if '_id' not in peer: returnValue(result(Error.wrongParameters))

            currentRooms = yield self.db.rooms.find({'isPrivate': True,
                                                     'userIds': {'$all': [peer['_id'], session['userId']]}})
            if len(currentRooms) != 0: returnValue(result(Error.roomAlreadyExists))
            
            roomId = yield self.db.rooms.insert({'isPrivate': True, 'userIds': [peer['_id'], session['userId']]})
            room = yield self.db.rooms.find_one({'_id': roomId})

            peerSession = yield self.db.sessions.find_one({'userId': peer['_id']})
            if '_id' in peerSession:
                self.publish('club.cottonway.chat.on_new_room', returnRoom(room, peerSession['userId']),
                             options=wamp.types.PublishOptions(eligible=[peerSession['wampSessionId']]))

            returnValue(result(room=returnRoom(room, session['userId'])))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.chat.messages')
    @inlineCallbacks
    def messages(self, roomId, messageIds, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            req = dict()
            if roomId is not None: req['roomId'] = ObjectId(roomId)
            if messageIds is not None: req['_id'] = {'$in': map(lambda i: ObjectId(i), messageIds)}
                
            messages = yield self.db.messages.find(req)
                
            roomIds = set(map(lambda m: m['roomId'], messages))
            userRooms = yield self.db.rooms.find({'_id': {'$in': list(roomIds)},
                                                  'userIds': session['userId']})
            if len(roomIds) != len(userRooms): returnValue(result(Error.wrongParameters))

            newMessages = yield self.db.newMessages.find({'messageId': {'$in': map(lambda m: m['_id'], messages)}})
            newMessages = set(map(lambda m: m['messageId'], newMessages))

            returnValue(result(messages=map(lambda m: returnMessage(m, m['_id'] in newMessages), messages)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.chat.send_message')
    @inlineCallbacks
    def sendMessage(self, roomId, text, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))
                                                      
            room = yield self.db.rooms.find_one({'_id': ObjectId(roomId)})
            messageId = yield self.db.messages.insert({'roomId': ObjectId(roomId), 'sender': session['userId'],
                                                       'text': text, 'time': datetime.utcnow()})
            peerIds = filter(lambda i: i != session['userId'], room['userIds'])
            newMessages = map(lambda i: {'userId': i, 'messageId': messageId}, peerIds)

            if len(newMessages) != 0:
                yield self.db.newMessages.insert(newMessages)
            message = yield self.db.messages.find_one({'_id': messageId})
            
            peerSessions = yield self.db.sessions.find({'userId': {'$in': peerIds}})
            peerSessionIds = map(lambda s: s['wampSessionId'], peerSessions)
            if len(peerSessionIds) != 0:
                self.publish('club.cottonway.chat.on_new_message', returnMessage(message, True),
                             options=wamp.types.PublishOptions(eligible=peerSessionIds))
            
            returnValue(result(message=returnMessage(message, False)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.exchange.tasks')
    @inlineCallbacks
    def tasks(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            solvedTaskIds = set(user['solvedTaskIds'])

            tasks = yield self.db.tasks.find({'isOpen': True})

            returnValue(result(tasks=map(lambda t: returnTask(t, t['_id'] in solvedTaskIds), tasks)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.exchange.send_flag')
    @inlineCallbacks
    def sendFlag(self, taskId, flag, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            task = yield self.db.tasks.find_one({'_id': ObjectId(taskId), 'isOpen': True})
            if '_id' not in task: returnValue(result(Error.wrongParameters))
            if flag != task['flag']: returnValue(result(Error.wrongFlag))

            while True:
                user = yield self.db.users.find_one({'_id': session['userId']})
                if '_id' not in user: returnValue(result(Error.error))
                if task['_id'] in set(user['solvedTaskIds']): returnValue(result(Error.alreadySolved))

                version = user['version']
                user['version'] += 1
                user['solvedTaskIds'].append(task['_id'])
                user['score'] += task['price']

                res = yield self.db.users.update({'_id': user['_id'], 'version': version}, user)
                if res['updatedExisting']: break

            userSessions = yield self.db.sessions.find({'userId': user['_id']})
            userSessionIds = map(lambda s: s['wampSessionId'], userSessions)
            if len(userSessionIds) != 0:
                self.publish('club.cottonway.exchange.on_task_updated', returnTask(task, True),
                             options=wamp.types.PublishOptions(eligible=userSessionIds))

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.exchange.update_task')
    @inlineCallbacks
    def updateTask(self, task, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            fileds = ['title', 'shortDesc', 'desc', 'categories', 'price', 'flag', 'isOpen']
            data = copyDict(task, fields)
            taskId = ObjectId()

            if 'id' in task:
                t = yield self.db.tasks.find_one({'_id': ObjectId(task['id'])})
                if '_id' not in t: returnValue(result(Error.error))

                t.update(data)
                yield self.db.tasks.update({'_id': t['_id']}, t)
                taskId = t['_id']
            else:
                if not checkKeys(data, fields):
                    returnValue(result(Error.error))
                taskId = yield self.db.tasks.insert(data)

            t = yield self.db.tasks.find({'_id': taskId})

            sessions = yield self.db.sessions.find()

            users = []
            if t['isOpen']: users = yield self.db.users.find()
            else: users = yield self.db.users.find({'isAdmin', True})
            
            solved = dict(zip(map(lambda u: u['_id'], users),
                              map(lambda u: set(u['solvedTaskIds']), users)))

            userSessionIds = {}
            for s in sessions:
                if s['userId'] not in userSessions: userSessionIds[s['userId']] = []
                userSessionIds[s['userId']].append(s['wampSessionId'])
                
            for u in users:
                if len(userSessions[u['_id']]) != 0:
                    self.publish('club.cottonway.exchange.on_task_updated', returnTask(t, t['_id'] in solved[u['_id']]),
                                 options=wamp.types.PublishOptions(eligible=userSessionIds[u['_id']]))

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.quest.steps')
    @inlineCallbacks
    def steps(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))

            steps = yield self.db.steps.find()
            stepsDict = dict(zip(map(lambda s: s['_id'], steps), steps))
        
            returnValue(result(steps=map(lambda m: returnStep(stepsDict[m['stepId']], m['time']), user['stepMoments'])))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.quest.all_steps')
    @inlineCallbacks
    def allSteps(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            steps = yield self.db.steps.find()
        
            returnValue(result(steps=map(returnAdminStep, step)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.quest.update_step')
    @inlineCallbacks
    def updateStep(self, step, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            fields = ['desc', 'prev', 'isActive']
            data = copyDict(step, fields)
            stepId = None

            if 'id' in step:
                s = yield self.db.steps.find_one({'_id': ObjectId(step['id'])})
                if '_id' not in s: returnValue(result(Error.error))

                s.update(data)
                yield self.db.steps.update({'_id': s['_id']}, s)
                stepId = s['_id']
            else:
                if not checkKeys(data, fields): returnValue(result(Error.error))
                stepId = yield self.db.steps.insert(data)

            s = yield self.db.steps.find({'_id': stepId})

            users = yield self.db.users.find({'$or': [{'stepMoments.stepId': stepId}, {'isAdmin': True}]})
            sessions = yield self.db.sessions.find({'userId': {'$in': map(lambda u: u['_id'], users)}})

            userSessionIds = {}
            for s in sessions:
                if s['userId'] not in userSessions: userSessions[s['userId']] = []
                userSessionIds[s['userId']].append(s['wampSessionId'])

            for u in users:
                if len(userSessions[u['_id']]) != 0:
                    time = None
                    for m in user['stepMoments']:
                        if m['stepId'] == stepId:
                            time = m['time']
                            break
                    self.publish('club.cottonway.exchange.on_step_updated', returnStep(s, time),
                                 options=wamp.types.PublishOptions(eligible=userSessionIds[u['_id']]))

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.quest.open_step')
    @inlineCallbacks
    def openStep(self, peerId, stepId, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            yield self.db.users.update({'_id': ObjectId(peerId)},
                                       {'$push': {'stepMoments': {'stepId': ObjectId(stepId),
                                                                  'time': datetime.utcnow()}}})

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))
