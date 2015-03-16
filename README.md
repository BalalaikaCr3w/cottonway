#Intro
Cotton way club sources

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