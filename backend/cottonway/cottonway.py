# coding: utf-8

from twisted.internet.defer import inlineCallbacks, returnValue

from autobahn import wamp
from autobahn.twisted.wamp import ApplicationSession

import txmongo
from txmongo import filter as qf

from bson import ObjectId

from datetime import datetime, timedelta

import traceback

from twisted.python import randbytes

from base64 import b64encode, b64decode

from enum import IntEnum

import string

from operator import itemgetter


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

errorMessages = {
    Error.error: u'Ошибка',
    Error.wrongEmail: u'Некорректный email',
    Error.wrongName: u'Некорректное имя пользователя',
    Error.wrongPassword: u'Некорректный пароль',
    Error.wrongCredentials: u'Неверные параметры авторизации',
    Error.notAuthenticated: u'Не аутентифицирован',
    Error.wrongParameters: u'Неправильные параметры',
    Error.roomAlreadyExists: u'Комната уже существует',
    Error.wrongFlag: u'Неверный флаг',
    Error.alreadySolved: u'Уже решено'
}


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

    if kwargs['callStatus'] != Error.ok: kwargs['errorMessage'] = errorMessages[args[0]]
        
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

def returnBasicTask(task):
    r = {'id': str(task['_id'])}
    r.update(copyDict(task, ['title', 'shortDesc', 'desc', 'categories', 'price']))
    return r

def returnTask(task, isSolved):
    r = returnBasicTask(task)
    r.update({'isSolved': isSolved})
    return r

def returnAdminTask(task):
    r = returnBasicTask(task)
    r.update(copyDict(task, ['isOpen', 'flag']))
    return r

def returnBasicStep(step):
    r = {'id': str(step['_id'])}
    r.update(copyDict(step, ['desc', 'seq', 'hasAction', 'needInput', 'actionName']))
    return r

def returnStep(step, time):
    r = returnBasicStep(step)
    r.update({'time': time.isoformat()})
    return r

def returnAdminStep(step):
    r = returnBasicStep(step)
    r.update(copyDict(step, ['isActive', 'flag']))
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

            if (type(name) is not unicode or len(name) == 0 or len(name) > 10
                or not set(name).issubset(allowedName)):
                returnValue(result(Error.wrongName))

            if type(password) is not unicode or len(password) == 0:
                returnValue(result(Error.wrongPassword))

            # TODO: set only first step, it's here for debug now
            steps = yield self.db.steps.find(filter=qf.sort(qf.ASCENDING('seq')))
            stepMoments = []
            now = datetime.utcnow()
            for step in steps:
                if not step['isActive']: break
                stepMoments.append({'stepId': step['_id'], 'time': now})
                now += timedelta(hours=1)

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
    def signIn(self, email, password, details, **kwargs):
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
    def sendMessage(self, roomId, text, details, **kwargs):
        try:
            if type(text) is not unicode or len(text) == 0 or len(text) > 255:
                returnValue(result(Error.wrongParameters))

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
    def sendFlag(self, taskId, flag, details, **kwargs):
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

            yield self.notifyRatingUpdated(user)

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

            steps = yield self.db.steps.find(filter=qf.sort(qf.ASCENDING('seq')))
            stepsDict = dict(zip(map(lambda s: s['_id'], steps), steps))
        
            returnValue(result(steps=map(lambda m: returnStep(stepsDict[m['stepId']], m['time']), user['stepMoments'])))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.quest.action')
    @inlineCallbacks
    def action(self, stepId, data=None, details=None):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))

            if not ObjectId(stepId) in map(lambda m: m['stepId'], user['stepMoments']):
                returnValue(result(Error.error))

            returnValue(result())
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @inlineCallbacks
    def getUserSessionIds(self, users):
        sessions = yield self.db.sessions.find({'userId': {'$in': map(lambda u: u['_id'], users)}})

        userSessionIds = {}
        for session in sessions:
            if session['userId'] not in userSessionIds: userSessionIds[session['userId']] = []
            userSessionIds[session['userId']].append(session['wampSessionId'])

        returnValue(userSessionIds)

    @wamp.register(u'club.cottonway.common.peers')
    @inlineCallbacks
    def commonPeers(self, peerIds=None, details=None):
        try:
            query = {}
            if peerIds is not None: query = {'_id': {'$in': map(lambda i: ObjectId(i), peerIds)}}

            users = yield self.db.users.find(query)
            returnValue(result(peers=map(lambda u: returnPeer(u), users)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.common.rating')
    @inlineCallbacks
    def rating(self, details):
        try:
            users = yield self.db.users.find()
            stepsCount = yield self.db.steps.count()

            rating = map(lambda u: self.getUserRating(u, stepsCount), users)
            rating = sorted(rating, key=itemgetter('lastStepTime'))
            rating = sorted(rating, key=itemgetter('score'), reverse=True)
            rating = sorted(rating, key=itemgetter('progress'), reverse=True)

            returnValue(result(rating=rating))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    def getUserRating(self, user, stepsCount):
        r = {'id': str(user['_id']),
             'progress': 100 * len(user['stepMoments']) / stepsCount,
             'lastStepTime': max(user['stepMoments'], key=itemgetter('time'))['time'].isoformat()}
        r.update(copyDict(user, ['name', 'score']))
        return r

    def notifyRatingUpdated(self, user):
        stepsCount = yield self.db.steps.count()
        self.publish('club.cottonway.common.on_rating_updated', self.getUserRating(user, stepsCount))

    @wamp.register(u'club.cottonway.admin.tasks')
    @inlineCallbacks
    def adminTasks(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            tasks = yield self.db.tasks.find()
        
            returnValue(result(tasks=map(returnAdminTask, tasks)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.admin.update_task')
    @inlineCallbacks
    def updateTask(self, task, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            fields = ['title', 'shortDesc', 'desc', 'categories', 'price', 'flag', 'isOpen']
            data = copyDict(task, fields)
            taskId = ObjectId()

            if 'id' in task:
                taskId = ObjectId(task['id'])
                yield self.db.tasks.update({'_id': ObjectId(taskId)}, {'$set': data})
            else:
                if not checkKeys(data, fields): returnValue(result(Error.error))
                taskId = yield self.db.tasks.insert(data)

            t = yield self.db.tasks.find_one({'_id': taskId})
            if '_id' not in t: returnValue(result(Error.error))

            if t['isOpen']:
                users = yield self.db.users.find()
                userSessionIds = yield self.getUserSessionIds(users)
                solved = dict(zip(map(lambda u: u['_id'], users),
                                  map(lambda u: set(u['solvedTaskIds']), users)))

                for u in users:
                    if u['_id'] in userSessionIds:
                        self.publish('club.cottonway.exchange.on_task_updated', returnTask(t, t['_id'] in solved[u['_id']]),
                                     options=wamp.types.PublishOptions(eligible=userSessionIds[u['_id']]))

            admins = yield self.db.users.find({'isAdmin': True})
            adminSessionIds = yield self.getSessionIds(admins)

            if len(adminSessionIds) != 0:
                self.publish('club.cottonway.admin.on_task_updated', returnAdminTask(t),
                             options=wamp.types.PublishOptions(eligible=adminSessionIds))
            

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.admin.steps')
    @inlineCallbacks
    def adminSteps(self, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            steps = yield self.db.steps.find(filter=qf.sort(qf.ASCENDING('seq')))
        
            returnValue(result(steps=map(returnAdminStep, steps)))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.admin.update_step')
    @inlineCallbacks
    def updateStep(self, step, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            fields = ['desc', 'seq', 'isActive', 'hasAction', 'needInput', 'flag', 'actionName']
            data = copyDict(step, fields)
            stepId = None

            if 'id' in step:
                stepId = ObjectId(step['id'])
                yield self.db.steps.update({'_id': stepId}, {'$set': data})
            else:
                if not checkKeys(step, fields): returnValue(result(Error.error))
                stepId = yield self.db.steps.insert(data)

            s = yield self.db.steps.find_one({'_id': stepId})

            users = yield self.db.users.find({'stepMoments.stepId': stepId})
            yield self.notifyStepUpdated(s, users)

            admins = yield self.db.users.find({'isAdmin': True})
            adminSessionIds = yield self.getSessionIds(admins)

            if len(adminSessionIds) != 0:
                self.publish('club.cottonway.admin.on_step_updated', returnAdminStep(s),
                    options=wamp.types.PublishOptions(eligible=adminSessionIds))

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @wamp.register(u'club.cottonway.admin.open_next_step')
    @inlineCallbacks
    def openNextStep(self, peerId, details):
        try:
            session = yield self.db.sessions.find_one({'wampSessionId': details.caller})
            if '_id' not in session: returnValue(result(Error.notAuthenticated))

            user = yield self.db.users.find_one({'_id': session['userId']})
            if '_id' not in user: returnValue(result(Error.error))
            if not user['isAdmin']: returnValue(result(Error.notAuthenticated))

            peer = yield self.db.users.find_one({'_id': ObjectId(peerId)})
            if '_id' not in peer: returnValue(result(Error.error))
            if len(user['stepMoments']) == 0: returnValue(result(Error.error))
            stepMoments = sorted(user['stepMoments'], key=itemgetter('time'), reverse=True)

            lastStep = yield self.db.steps.find_one({'_id': stepMoments[0]['stepId']})
            if '_id' not in lastStep: returnValue(result(Error.error))
            nextStep = yield self.db.steps.find_one({'seq': lastStep['seq'] + 1})

            yield self.db.users.update({'_id': ObjectId(peerId)},
                                       {'$push': {'stepMoments': {'stepId': nextStep['_id'],
                                                                  'time': datetime.utcnow()}}})

            yield self.notifyStepUpdated(nextStep, [user])
            yield self.notifyRatingUpdated(user)

            returnValue(result(Error.ok))
        except Exception as e:
            traceback.print_exc()
            traceback.print_stack()
            returnValue(result(Error.error))

    @inlineCallbacks
    def notifyStepUpdated(self, step, users):
        userSessionIds = yield self.getUserSessionIds(users)

        for u in users:
            if len(userSessionIds[u['_id']]) != 0:
                stepMoments = u['stepMoments']
                stepMoments = dict(zip(map(lambda m: m['stepId'], stepMoments),
                                       map(lambda m: m['time'], stepMoments)))
                self.publish('club.cottonway.quest.on_step_updated', returnStep(step, stepMoments[step['_id']]),
                             options=wamp.types.PublishOptions(eligible=userSessionIds[u['_id']]))

    @inlineCallbacks
    def getSessionIds(self, users):
        sessionIds = yield self.db.sessions.find({'userId': {'$in': map(lambda u: u['_id'], users)}})
        returnValue(map(lambda s: s['wampSessionId'], sessionIds))
