#Intro
Cotton way club sources. This is a web application for holding quest and jeopardy-style games. It was used during RusCrypto 2015 conference. We intend to make universal CTF platform based on these sources.

#Frontend

##Development

```
$ cd frontend
$ npm install
$ bower install
$ grunt build-dev
$ grunt watch
```

In browser set the `developer` cookie to make js do requests to developer api server.

##Production build

```
$ cd frontend
$ grunt build
```

Then setup your webserver on `public` folder.

##Run locally

```
$ cd frontend
$ node server/index.js
```

#Backend

You must have MongoDB installed and run.

```
$ cd backend
$ sudo pip2 install -r requirements.txt
$ mkdir .crossbar
$ cp config.json .crossbar/
$ ln -s ../frontend/public/ web
$ crossbar start
```
