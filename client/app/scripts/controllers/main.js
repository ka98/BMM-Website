'use strict';

angular.module('bmmApp')
  .controller('MainCtrl', function (
    $scope,
    $timeout,
    $location,
    $route,
    $window,
    _init,
    _api,
    _playlist,
    _play,
    _player,
    _draggable
  ) {

    $scope.load = _init.load;

    _init.load.complete.promise.then(function() {

      $scope.init = _init;
      $scope.now = function() { return new Date(); };

      $scope.pushMessages = [];

      $scope.removePushMessage = function(index) {
        $scope.pushMessages.splice(index,1);
        $scope.saveSession();
      };

      $scope.saveSession = function() {
        localStorage[_init.user.username] = angular.toJson({
          contentLanguage: $scope.init.contentLanguage,
          contentLanguages: $scope.init.contentLanguages,
          websiteLanguage: $scope.init.websiteLanguage,
          videoFirst: _player.videoFirst,
          pushMessages: $scope.pushMessages
        });
      };

      $scope.restoreSession = function() {
        var model = angular.fromJson(localStorage[_init.user.username]);
        if (typeof model!=='undefined') {
          if (typeof model.pushMessages!=='undefined') {
            $scope.pushMessages = model.pushMessages;
          }
          _player.videoFirst = model.videoFirst;

          $scope.init.contentLanguage = _init.contentLanguage = model.contentLanguage;
          $scope.init.contentLanguages = _init.contentLanguages = model.contentLanguages;

          //This is just so that users that still only have 1 language in their
          //localStorage, keep their language, but can add more if they want.
          if(model.contentLanguage && model.contentLanguages == undefined) {
            $scope.init.contentLanguages = _init.contentLanguages = [_init.contentLanguage];
          };

          _api.setContentLanguages(_init.contentLanguages);
          _api.setContentLanguage(_init.contentLanguage);

          if (typeof _init.translations[model.websiteLanguage]!=='undefined') {
            $scope.init.websiteLanguage = _init.websiteLanguage = model.websiteLanguage;
            $scope.init.translation = _init.translation = _init.translations[model.websiteLanguage];
          }
        }
      };
      $scope.restoreSession();

      $scope.$parent.$watch('init.contentLanguage', function(lang) {
        if (typeof contentLanguage!=='undefined') {
          $scope.init.podcastLanguage = lang;
        }
      });

      $scope.getCurrent = function() {
        $location.path( _playlist.getUrl() );
      };

      $scope.setLanguageChanged = function() {
        $scope.contentLangChanged = true;
      };

      $scope.sortableOptions = {
        handle: '.sort_handle',
        update: function() {
          $scope.setLanguageChanged();
        },
        axis: 'y' 
      };

      //This filter functions filters out the languages
      //that are already selected. Prevents duplicates.
      $scope.exceptSelected = function(item) {
        return $scope.init.contentLanguages.indexOf(item) === -1;
      };

      $scope.addLanguage = function() {
        var langs = $scope.init.root.languages;
        for(var i = 0; i < langs.length; i++) {
          var lang = langs[i];
          if($scope.exceptSelected(lang)) {
            $scope.init.contentLanguages.push(lang);
            return;
          }
        };
      };

      $scope.setContentLangConditional = function() {
        if($scope.contentLangChanged) {
          $scope.setContentLanguages($scope.init.contentLanguages);
          $scope.contentLangChanged = false;
        };
      };

      $scope.setContentLanguages = function(langs) {
        //The first language is the 'primary' content language
        $scope.init.contentLanguage = _init.originalLanguage = _init.contentLanguage = langs[0];
        $scope.init.contentLanguages = _init.originalLanguages = _init.contentLanguages = langs;
        _api.setContentLanguages(langs);
        _api.setContentLanguage(langs[0]);
        $scope.saveSession();
        $route.reload();
      };

      $scope.setWebsiteLanguage = function(lang) {
        $scope.init.websiteLanguage = lang;
        $scope.init.translation = _init.translation = _init.translations[lang];
        $scope.saveSession();
      };

      $scope.go = function ( path ) {
        $location.path( path );
      };

      $scope.play = function(playlist, index, timestamp, verse) {

        if (typeof verse!=='undefined') {
          $window.ga('send', 'event', 'bible verse', 'play', verse);
        }

        _play.setPlay(playlist, index, true, timestamp);
      };

      //Deprecated
      $scope.addToPlaylist = function(playlistId, trackId, language) {
        _api.userTrackCollectionLink(playlistId, [
          trackId
        ], language);
      };

      $scope.addTracksToPlaylist = function(playlistId, tracks) {
        var ids = [];
        $.each(tracks, function() {
          ids.push(this.id);
        });
        _api.userTrackCollectionLink(playlistId, ids, _init.contentLanguage);
      };

      $scope.addPLaylist = function(newPlaylist) {

        _api.userTrackCollectionPost({
          name: newPlaylist,
          type: 'track_collection',
          access: [_init.user.username]
        }).always(function(xhr) {

          if (xhr.status===201) {

            $scope.$apply(function() {

              $scope._playlistAdd = false;
              $scope.newPlaylist = '';
              $scope.init.user.track_collections.splice(0,0, {
                id: xhr.getResponseHeader('X-Document-Id'),
                name: newPlaylist
              });

              $timeout(function() {
                $scope.$apply(function() {
                  //For playlists
                  $('.draggable-playlist').trigger('dragdrop');
                  //Other _draggables
                  _draggable.makeDraggable($scope);
                });
              });

            });
          }

        });

      };

      $scope.removePLaylist = function(playlist) {
        if (confirm(_init.translation.playlist.confirmPlaylistDeletion)) {
          _api.userTrackCollectionDelete(playlist).fail(function(xhr) {
            if (xhr.status<300) {
              $.each($scope.init.user.track_collections, function(index) {
                if (this.id===playlist) {
                  $scope.$apply(function() {
                    $scope.init.user.track_collections.splice(index,1);
                  });
                  return false;
                }
              });
            }
          });
        }
      };

      $scope.renamePlaylist = function(_collection) {

        _api.userTrackCollectionGet(_collection.id).done(function(collection) {

          var makeReferences = function(tracks) {
            var ref=[];
            $.each(tracks, function() {
              ref.push({
                id: this.id,
                language: this.language
              });
            });
            return ref;
          };

          _api.userTrackCollectionPut(_collection.id, {
            name: _collection.newName,
            type: 'track_collection',
            track_references: makeReferences(collection.tracks),
            access: collection.access
          }).always(function() {

            $scope.$apply(function() {
              _collection.edit = false;
              _collection.name = _collection.newName;
            });

          });

        });

      };

      $scope.exitRename = function(_collection) {
        _collection.edit = false;
      };

      $scope.isActive = function (viewLocation) {
        return viewLocation === $location.path();
      };

      $('.bmm-view').off('scrollBottom');
      $(window).bind('scroll', function() {
        if($(window).scrollTop() + $(window).height()>=$(document).height()) {
          $(window).trigger('scrollBottom');
        }
      });

    });

  });