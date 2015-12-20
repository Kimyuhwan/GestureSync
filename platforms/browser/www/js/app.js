// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'ngMaterial', 'ngCordova', 'chart.js','btford.socket-io'])

.run(function($ionicPlatform, $rootScope, $state) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }

    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleLightContent();
    }

    document.addEventListener("pause", function() {
        console.log("The application is paused");
        $rootScope.$apply(function() {
            $rootScope.eventHappen = "pause";
        });
    }, false);

    document.addEventListener("resume", function() {
        console.log("The application is resuming");
        $rootScope.$apply(function() {
            $rootScope.eventHappen = "resume";
        });
    }, false);

    $state.go('train');
    //$rootScope.$apply();

  });


})

.config(function($stateProvider, $urlRouterProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

  .state('login', {
    url: '/login',
    templateUrl: 'templates/_login.html',
    controller: 'loginCtrl'
  })

  .state('train', {
    url: '/train',
    templateUrl: 'templates/_train.html',
    controller: 'trainCtrl'
  });

  //.state('home', {
  //  url: '/home',
  //  templateUrl: 'templates/home.html',
  //  controller: 'homeCtrl'
  //})
  //
  //.state('analysis', {
  //  url: '/analysis',
  //  params: {raw_data: null},
  //  templateUrl: 'templates/analysis.html',
  //  controller: 'analysisCtrl'
  //})
  //
  //.state('demo', {
  //  url: '/demo',
  //  templateUrl: 'templates/demo.html',
  //  controller: 'demoCtrl'
  //})
  //
  //.state('oz', {
  //  url: '/oz',
  //  templateUrl: 'templates/oz.html',
  //  controller: 'ozCtrl'
  //})
  //
  //.state('end', {
  //  url: '/end',
  //  templateUrl: 'templates/end.html',
  //  controller: 'endCtrl'
  //})
  //
  //.state('soundtest', {
  //  url: '/soundtest',
  //  templateUrl: 'templates/soundtest.html',
  //  controller: 'soundCtrl'
  //});


  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/home');

});
