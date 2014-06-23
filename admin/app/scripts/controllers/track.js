'use strict';

angular.module('bmmApp')
  .controller('TrackCtrl', function (
    $scope,
    $filter,
    $location,
    $rootScope,
    $routeParams,
    $timeout,
    waitings,
    bmmPlay,
    bmmApi,
    init,
    bmmFormatterTrack,
    bmmFormatterAlbum,
    quickMenu
    ) {

    var modelLoaded=false, newTrack=false;

    if ($routeParams.id==='new') {
      newTrack = true;
    }

    $scope.model = {}; //Raw
    $scope.standardModel = {}; //Standard
    $scope.status = init.translation.states.noChanges;
    $scope.possibleSubtypes = [
      'song',
      'speech',
      'audiobook',
      'singsong',
      'exegesis',
      'video'
    ];

    $scope.fetchModel = function(_raw) {
      if (!newTrack) {
        if (typeof _raw==='undefined'||_raw) {
          return bmmApi.trackGet($routeParams.id, '', { raw: true });
        } else {
          return bmmApi.trackGet($routeParams.id, init.mediaLanguage, {
            unpublished: 'show'
          });
        }
      } else {

        if (typeof $routeParams.order==='undefined') {
          $routeParams.order = 1;
        }

        if (typeof $routeParams.language==='undefined') {
          $routeParams.language = init.mediaLanguage;
        }

        if (typeof $routeParams.date==='undefined') {
          $routeParams.date = new Date();
        }

        var languages = [];
        if (typeof $routeParams.languages==='undefined') {
          languages = [{
            language: $routeParams.language,
            title: '',
            is_visible: false,
            media: []
          }];
        } else {
          $.each($routeParams.languages.split(','), function() {
            languages.push({
              language: this,
              title: '',
              is_visible: false,
              media: []
            });
          });
        }

        $scope.model = {
          parent_id: $routeParams.parentId,
          order: parseInt($routeParams.order),
          type: 'track',
          subtype: 'song',
          recorded_at: $routeParams.date,
          published_at: new Date(),
          original_language: $routeParams.language,
          is_visible: true,
          translations: languages,
          tags: [],
          cover: null,
          cover_upload: null,
          rel: []
        };
        return;
      }
    };

    $scope.refreshModel = function() {
      try {
        $scope.fetchModel().done(function(model) {
          $scope.$apply(function() {
            $scope.model = model;
            findAvailableTranslations();
            findAvailableTags();
          });
          modelLoaded = true;
        });
        $scope.fetchModel(false).done(function(model) {
          $scope.$apply(function() {
            $scope.standardModel = model;
            $scope.formattedModel = bmmFormatterTrack.resolve(model);
            quickMenu.setMenu($scope.standardModel._meta.root_parent.published_at.substring(0,4),
                      $scope.standardModel._meta.root_parent.id,
                      $scope.standardModel.parent_id);
          });
        });
      }
      catch(err) {
        //Model is not yet created, fires when routeParams.id === 'new'
        $timeout(function() {
          findAvailableTranslations();
          findAvailableTags();
        });
      }
    };
    $scope.refreshModel();

    var saveModel = function() {

      //Delete parts that's unexpected by the API
      var toApi = angular.copy($scope.model);
      delete toApi._meta;
      delete toApi.id;

      $.each(toApi.translations, function() {
        delete this._meta;

        //@todo - remove when new developer data is added
        if (typeof this.media!=='undefined'&&this.media!==null) {
          $.each(this.media, function() {
            if (typeof this.files!=='undefined'&&this.files!==null) {
              $.each(this.files, function() {
                if (typeof this.length!=='undefined') {
                  this.duration = this.length;
                  delete this.length;
                }
              });
            } else {
              this.files = [];
            }
          });
        } else {
          this.media = [];
        }

      });

      if (newTrack) {
        return bmmApi.trackPost(toApi).always(function(xhr) {
          if (xhr.status===201) {
            $location.path('/track/'+xhr.getResponseHeader('X-Document-Id'));
          } else {
            $scope.status = init.translation.states.couldNotCreateTrack+', '+
                            init.translation.states.errorCode+': '+xhr.status;
          }
        });
      } else {
        return bmmApi.trackPut($routeParams.id, toApi);
      }
    };

    $scope.play = function(file, type) {

      var track = bmmFormatterTrack.resolve($scope.standardModel);

      track.audio = false;
      track.video = false;
      track[type] = true;

      track[(type+'s')] = [{
        file: bmmApi.secureFile($filter('bmmFilePath')(file.path)),
        type: file.mime_type,
        duration: file.duration,
        name: file.mime_type
      }];

      track.language = $scope.edited.language;
      track.title = $scope.edited.title;

      bmmPlay.setPlay([track], 0);

    };

    $scope.download = function(path) {
      window.location = $filter('bmmFilePath')(path)+'?download=1';
    };

    $scope.playLinked = function(track) {
      bmmPlay.setPlay([track], 0);
    };

    $scope.save = function(options) {
      $scope.status = init.translation.states.attemptToSave;

      saveModel().done(function() {
        $scope.status = init.translation.states.saveSucceedFetchingNewData;
        $scope.$apply();
        $scope.fetchModel().done(function(model) {
          $scope.$apply(); //Model-watcher updates status to changed
          $scope.model = model;
          findAvailableTranslations();
          findAvailableTags();
          $timeout(function() { //Secure that watcher is fired
            $scope.status = init.translation.states.saved; //Update status
            $scope.$apply(); //Render status
          });
          $scope.$apply(function() {
            $scope.status = init.translation.states.saved;
            if (typeof options!=='undefined'&&typeof options.done!=='undefined') {
              options.done();
            }
            quickMenu.refresh();
          });
        }).fail(function() {
          $scope.status = init.translation.states.couldNotFetchData;
          $scope.$apply();
        });
        $scope.fetchModel(false).done(function(model) {
          $scope.$apply(function() {
            $scope.standardModel = model;
            quickMenu.setMenu($scope.standardModel._meta.root_parent.published_at.substring(0,4),
              $scope.standardModel._meta.root_parent.id,
              $scope.standardModel.parent_id);
          });
        });
      }).fail(function() {
        $scope.status = init.translation.states.couldNotSave;
        $scope.$apply();
      });

    };

    $scope.delete = function() {
      if (typeof $scope.model.id!=='undefined') {
        if (confirm(init.translation.warnings.confirmTrackDeletion)) {
          bmmApi.trackDelete($scope.model.id).always(function() {
            $scope.$apply(function() {
              alert(init.translation.states.trackDeleted);
              quickMenu.refresh();
              $location.path( '/' );
            });
          });
        }
      }
    };

    $scope.deleteFile = function(media, parentIndex, index) {
      $scope.deleteFromArray(media[parentIndex].files, index);
      if (media[parentIndex].files.length<1) {
        media.splice(parentIndex, 1);
      }
    };

    $scope.deleteFromArray = function(array, index) {
      $.each(array, function() {
        array.splice(index,1);
      });
    };

    var findAvailableTranslations = function() {
      $scope.availableLanguages = [];
      bmmApi.root().done(function(root) {
        $scope.$apply(function() {
          $.each(root.languages, function() {
            var available = this, found=false;
            $.each($scope.model.translations, function() {
              if (this.language===available) {
                found = true;
              }
            });
            if (!found) {
              $scope.availableLanguages.push(available);
            }
          });
          if (typeof $scope.edited==='undefined') {
            $scope.switchLanguage($scope.model.original_language);
          } else {
            $scope.switchLanguage($scope.edited.language);
          }
        });
      });
    };

    $scope.addLanguage = function(lang) {
      $scope.model.translations.push({
        is_visible: false,
        language: lang,
        title: '',
        media: []
      });
      $.each($scope.availableLanguages, function(index) {
        if (this === lang) {
          $scope.availableLanguages.splice(index,1);
          return false;
        }
      });
    };

    $scope.removeLanguage = function(lang) {
      if ($scope.edited.language===lang) {
        $scope.switchLanguage($scope.model.original_language);
      }
      $.each($scope.model.translations, function(index) {
        if (this.language === lang) {
          if (((typeof this.title!=='undefined'&&this.title.length>0)||
            (typeof this.media!=='undefined'&&this.media.length>0))&&
            !confirm(init.translation.warnings.confirmTranslatedDeletion)) {
            return false;
          }
          $scope.model.translations.splice(index,1);
          $scope.availableLanguages.push(lang);
          return false;
        }
      });
    };

    $scope.switchLanguage = function(newLang, oldLang) {
      if (typeof oldLang!=='undefined') {
        $.each($scope.model.translations, function(index) {
          if (this.language===oldLang) {
            $scope.model.translations[index] = $scope.edited;
            return false;
          }
        });
      }
      $.each($scope.model.translations, function() {
        if (this.language===newLang) {
          $scope.edited = this;
          return false;
        }
      });
    };

    $scope.$watch('edited', function(newEdit, oldEdit) {

      if (typeof newEdit!=='undefined'&&
          (typeof newEdit.media==='undefined'||newEdit.media===null||newEdit.media.length<1)) {
        newEdit.is_visible = false;

        if (typeof oldEdit!=='undefined'&&
          newEdit.is_visible===oldEdit.is_visible&&
          newEdit.language===oldEdit.language&&
          newEdit.title===oldEdit.title) {
          $scope.status = init.translation.page.editor.missingFile;
        }

      }

    }, true);

    $scope.$watch('model', function(model) {
      if (modelLoaded) {
        $scope.status = init.translation.states.changesPerformed;
      }

      if (typeof model.parent_id!=='undefined'&&model.parent_id!==null) {
        bmmApi.albumGet(model.parent_id, init.mediaLanguage, {
          unpublished: 'show'
        }).done(function(album) {
          $scope.$apply(function() {

            if (album.parent_id!==null) {

              $scope.findParentSubAlbums(album.parent_id, album.id);
              bmmApi.albumGet(album.parent_id, init.mediaLanguage, {
                unpublished: 'show'
              }).done(function(album) {
                $scope.albumParentYear = parseInt(album.published_at.substring(0,4),10);
                if (typeof $scope.parentAlbums==='undefined'||$scope.parentAlbums.length<=0) {
                  $scope.findParentAlbums($scope.albumParentYear, album);
                }
              });

            } else {
              $scope.albumParentYear = parseInt(album.published_at.substring(0,4),10);
              if (typeof $scope.parentAlbums==='undefined'||$scope.parentAlbums.length<=0) {
                $scope.findParentAlbums($scope.albumParentYear, album);
              }
            }

          });
        });
      }
    }, true);

    $scope.$watch('model.original_language', function(lang) {
      if (typeof $scope.model.translations!=='undefined') {
        $.each($scope.model.translations, function() {
          if (this.language===lang) {
            $scope.originalLanguage = this;
            return false;
          }
        });
      }
    });

    var suggestedTags = [
      'child-favorites',
      'instrumental',
      'mp3-kilden'
    ];

    var findAvailableTags = function() {
      $scope.availableTags = [];
      $.each(suggestedTags, function() {
        var available = this, found=false;
        $.each($scope.model.tags, function() {
          if (this===available) {
            found = true;
          }
        });
        if (!found) {
          $scope.availableTags.push(available);
        }
      });
    };

    $scope.addTag = function(tag) {
      $.each($scope.availableTags, function(index) {
        if (this===tag) {
          $scope.availableTags.splice(index,1);
          return false;
        }
      });
      $scope.model.tags.push(tag);
    };

    $scope.removeTag = function(tag) {
      $.each($scope.model.tags, function(index) {
        if (this===tag) {
          $scope.model.tags.splice(index,1);
          return false;
        }
      });
      $scope.availableTags.push(tag);
    };

    $scope.uploadCover = {
      url: bmmApi.getserverUrli()+'track/'+$routeParams.id+'/cover',
      method: 'PUT'
    };

    $scope.uploadMedia = {
      url: bmmApi.getserverUrli()+'track/'+$routeParams.id+'/files/',
      method: 'POST'
    };

    //FETCH ALBUMS
    $scope.parentAlbums = [];
    $scope.findParentAlbums = function(year, _album) {
      bmmApi.albumPublishedYear(year, {
        unpublished: 'show'
      }, init.mediaLanguage).done(function(albums) {

        $scope.$apply(function() {
          $.each(albums, function() {
            var album = bmmFormatterAlbum.resolve(this);
            $scope.parentAlbums.push(album);
          });
          $scope.parentAlbums.reverse();
          if (typeof _album!=='undefined') {
            $.each($scope.parentAlbums, function(index) {
              if (this.id===_album.id) {
                $scope.parentAlbum = $scope.parentAlbums[index];
                $scope.parentAlbumCurrent = this.title;
                return false;
              }
            });
          }
        });

      });
    };

    $scope.parentSubAlbums = [];
    $scope.findParentSubAlbums = function(id, sub_id) {
      bmmApi.albumGet(id, init.mediaLanguage, {
        unpublished: 'show'
      }).done(function(data) {

        $scope.$apply(function() {
          $.each(data.children, function() {
            if (this.type==='album') {
              var album = bmmFormatterAlbum.resolve(this);
              $scope.parentSubAlbums.push(album);
            }
          });
          $scope.parentSubAlbums.reverse();
          if (typeof sub_id!=='undefined') {
            $.each($scope.parentSubAlbums, function(index) {
              if (this.id===sub_id) {
                $scope.parentSubAlbum = $scope.parentSubAlbums[index];
                $scope.parentAlbumCurrent = this.title;
                return false;
              }
            });
          }
        });

      });
    };

    $scope.selectParentAlbum = function(album) {
      $scope.model.parent_id = album.id;
      $scope.parentAlbumCurrent = album.title;
    };

    bmmApi.fileUploadedGuessTracksGet().done(function(_waitings) {

      _waitings = waitings.resolve(_waitings);

      $scope.$apply(function() {

        $scope.waitings = [];
        $.each(_waitings.ready, function() {

          $.each(this.tracks, function() {

            $.each(this.files, function() {

              //When track with connection to current track is found
              if (this.track.id===$scope.model.id) {
                $scope.waitings.push(this.track);
              }

            });

          });

        });

      });

    });

    $scope.linkWaiting = function(link, id, lang, index) {
      bmmApi.fileUploadedNameLink(link, id, lang).done(function() {
        $scope.waitings.splice(index, 1);
        $scope.refreshModel();
      });
    };

  });