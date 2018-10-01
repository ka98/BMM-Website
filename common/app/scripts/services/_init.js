'use strict';

angular.module('bmmLibApp')
  .factory('_init', function ($http, $q, $location, _session, _api, _locals, $analytics) {

    var factory = {},
        loginAttempts = 3;

    //Common
    factory.user = {};
    factory.admin = false;
    factory.root = {};
    factory.translation = {};
    factory.translations = {}; //Object with actual translations
    factory.contentLanguages = ['nb', 'en']; //Fallback
    factory.isIOS = false;
    factory.config = {};
    factory.bible = {};
    factory.load = {
      percent: 0,
      progress: false,
      status: '',
      loaded: false,
      complete: $q.defer()
    },
    factory.blockingLoad = {
      loading: false 
    };

    _api.setContentLanguages(factory.contentLanguages);//Fallback
    _api.appendUnknownLanguage = true;

    factory.appendLanguage = function(langs, lang) {
      var langs = factory.contentLanguages;
      //No duplicates, only the first occurance counts.
      //Therefore don't insert, as the language already is there with a higher priority.
      if(langs.indexOf(lang) === -1) {
        factory.contentLanguages.push(lang);
      }
    };

    factory.prependLanguage = function(langs, lang) {
      //If the language already exists, then remove
      //the other occurence of it, because the new
      //one to be inserted has higher priority.
      var index = langs.indexOf(lang);
      if(index !== -1) {
        langs.splice(index, 1);
      };
      
      langs.splice(0, 0, lang);
    };

    factory.promise = function(admin) {
      if (typeof admin==='undefined') { admin = false; }
      factory.authorize(admin);
      return factory.load.complete.promise;
    };

    //Admin only
    factory.titles = {};

    factory.authorize = function(admin, attempt) {

      // -- Check if authorization has been attempted earlier
      if (typeof attempt!=='undefined'&&attempt>loginAttempts) {
        return false;
      } else if (typeof attempt==='undefined') {
        attempt = 0;
      }

      if (factory.load.loaded) { return; }
      if (factory.load.progress) { return; }
      factory.load.progress = true;
      if (typeof admin==='undefined') { admin = false; }

      factory.load.status = 'Loading configuration';

      // -- Load configurations
      $http.get('scripts/config.json').success(function(config) {

        factory.config = config;
        _api.serverUrl(config.knownServerUrls[config.serverUrlIndex]);
        _api.setKeepAliveTime(config.keepAlive*100*60);
        if(config.requestTimeout) {
          _api.setRequestTimeout(config.requestTimeout*1000);
        }

        // -- Secure that the correct protocol given by configuration is used
        if ($location.protocol()!==config.protocol&&
            $location.port()!==config.developerPort) {
          var link = config.protocol+'://'+window.location.href.substr(5);
          link = link.replace('////','//'); //IE FIX
          window.location = link;
        }

        factory.load.status = 'Attempt to login';

        // -- Attempt to login
        _api.loginUser().done(function(user) {

          factory.load.percent+=20;
          var promises = [];

          // -- User
          factory.user = user;

          // -- Admin
          factory.admin = isAdmin(user.roles);

          // -- Credentials
          _api.setCredentials(user.username, user.token);

          //Set the username for the angulartics reports:
          $analytics.setUsername(user.username);

          // -- Root & contentLanguage (Depends on root)
          var rootLoaded = $q.defer(),
              localsLoaded = $q.defer(),
              contentLanguageLoaded = $q.defer(),
              translationLoaded = $q.defer();
          promises.push(rootLoaded.promise);
          promises.push(localsLoaded.promise);
          promises.push(contentLanguageLoaded.promise);
          promises.push(translationLoaded.promise);

          factory.load.status = 'Fetching data';

          _api.root().done(function(root) {

            factory.load.status = 'Root loaded';

            //Temporary remove zxx because it's for multilingual content (@todo - remove later)
            var hiddenLanguages = ['zxx'];

            //iterate backwards because we're deleting elements.
            for(var i = root.languages.length -1; i >= 0 ; i--){
              var language = root.languages[i];
                if (hiddenLanguages.indexOf(language) !== -1) {
                    root.languages.splice(i, 1);
                }
            }

            factory.root = root;
            rootLoaded.resolve();
            factory.load.percent+=20;

            // -- contentLanguage
            if (factory.config.includeAllContentLanguages)
            {
              root.languages.forEach(function(el) {
                factory.appendLanguage(factory.contentLanguages, el);
              });
            }

            _session.restoreSession(user.username, user.languages);

            findcontentLanguages(_session.current.contentLanguages, 0, contentLanguageLoaded);
            findTranslation([_session.current.websiteLanguage], 0, translationLoaded);

            // -- Date locals
            _locals.fetchFiles(config.localsPath, _session.current.websiteLanguage).then(function() {
              localsLoaded.resolve();
              factory.load.percent+=10;
              console.log('fetchFiles is done');
            });
            console.log('fetchFiles has been triggered');
          });

          // -- isIOS (iphone, ipod, ipad ?)
          var ipad = (navigator.userAgent.match(/iPad/i) !== null),
              iphone = (navigator.userAgent.match(/iPhone/i) !== null),
              ipod = (navigator.userAgent.match(/iPod/i) !== null);
          if (ipad||iphone||ipod) {
            factory.isIOS = true;
          }

          if (admin) {
            // -- Album titles
            var titlesLoaded = $q.defer();
            promises.push(titlesLoaded.promise);
            $.ajax({
              url: config.titlesAlbum,
              success: function(data) {
                factory.titles.album = data;
                titlesLoaded.resolve();
              }
            });

            // -- Bibleverses
            var bibleLoaded = $q.defer();
            promises.push(bibleLoaded.promise);
            translationLoaded.promise.then(function() {
              findBible(factory.user.languages, 0, bibleLoaded);
            });
          }

          $q.all(promises).then(function() {
            factory.load.complete.resolve();
            factory.load.loaded = true;
            factory.load.progress = false;
            factory.load.percent+=10;
            factory.load.status = 'Loading complete';
          });

        }).fail(function() {

          if (attempt>=loginAttempts) {
            window.location = _api.getserverUrli()+'login/redirect?redirect_to='+window.location;
          }

          _api.loginRedirect({
            done: function() {
              factory.load.progress = false;
              factory.authorize(admin, (attempt+1));
            },
            fail: function(signOn) {
              window.location = signOn;
            }
          });

        });
      }).error(function() {
        factory.load.progress = false;
        factory.authorize(admin, (attempt+1));
      });
    };

    var isAdmin = function(roles) {
      var isAdmin = false;
      $.each(roles, function() {
        if (this==='ROLE_ADMINISTRATOR') { isAdmin = true; }
      });
      return isAdmin;
    }

    var findcontentLanguages = function(langs, index, promise) {

      factory.load.status = 'Find contentLanguage';

      //Iterate backwards so that the first item is added last.
      //And thus comes first in the contentLanguages Array;
      for(var i = langs.length-1; i > -1; i--) {
        factory.prependLanguage(factory.contentLanguages, langs[i]);
      }

      //Use the top language as website language and podcastLanguage
      factory.podcastLanguage = factory.contentLanguages[0];
      promise.resolve();
      factory.load.percent+=20;
    };

    var findTranslation = function(lang, index, promise) {

      factory.load.status = 'Fetch translation';

      //Fallback
      if (typeof lang[index]==='undefined'||lang.length<1) {
        if (lang[(index-1)]==='nb') {
          lang[index] = 'en'; //Second fallback
        } else {
          lang[index] = 'nb'; //First fallback
        }
      }

      //Attempt to fetch file
      $.ajax({
        url: factory.config.translationFolder+lang[index]+'.json',
        error: function() {
          findTranslation(lang, (index+1), promise);
        },
        success: function(data) {
          factory.translation = data;
          factory.translation['iso-639-1'] = lang[index];
          factory.translations[lang[index]] = data;
          promise.resolve();
          factory.load.percent+=20;
        }
      });
    };

    var findBible = function(lang, index, promise) {

      factory.load.status = 'Fetch bible';

      if (typeof lang[index]==='undefined'||lang.length<1) {
        lang[index] = 'nb'; //Fallback
      }

      $.ajax({
        url: factory.config.biblePath+lang[index]+'.json',
        error: function() {
          findBible(lang, (index+1), promise);
        },
        success: function(data) {
          factory.bible = data;
          promise.resolve();
        }
      });
    };

    return factory;
  });
