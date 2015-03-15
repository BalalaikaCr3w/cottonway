#Intro
Cotton way club sources

#New front

##Development

```
$ cd new
$ npm install
$ bower install
$ grunt build-dev
$ grunt watch
```

In browser set the `developer` cookie to make js do requests to developer api server.

##Production build

```
$ cd new
$ grunt build
```

Then setup your webserver on `public` folder.

##Run locally

```
$ cd new
$ node server/index.js
```