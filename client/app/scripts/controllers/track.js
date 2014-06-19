'use strict';

angular.module('bmmApp')
  .controller('TrackCtrl', function (
    $scope,
    $timeout,
    $routeParams,
    $location,
    $window,
    bmmApi,
    bmmFormatterAlbum,
    bmmFormatterTrack,
    init,
    bmmPlaylist,
    bmmPlay
  ) {

    $(window).off('scrollBottom');

    // @analytics - Report page view to google analytics
    $scope.$on('$viewContentLoaded', function(event) {
      $window.ga('send', 'pageview', {
        'page': '/track/'+$routeParams.id+'/'+$routeParams.language,
        'title': $routeParams.id+'/'+$routeParams.language
      });
    });

    $scope.tracks = 0;
    $scope.duration = 0;
    $scope.playlists = [];
    $scope.mainAlbum = [];
    var language;

    if (typeof $routeParams.language!=='undefined') {
      language = $routeParams.language;
    } else {
      language = init.mediaLanguage;
    }

    bmmApi.trackGet(
      $routeParams.id,
      language
    ).done(function(track) {

      bmmPlay.setPlay([bmmFormatterTrack.resolve(track)], 0);
      findPlayingTrack();
      bmmApi.albumGet(track.parent_id, language).done(function(mainAlbum) {

        var track;
        var formattedAlbum = bmmFormatterAlbum.resolve(mainAlbum);

        $scope.playlists.push({
          title: formattedAlbum.title,
          description: formattedAlbum.description,
          id: formattedAlbum.id,
          cover: formattedAlbum.cover,
          duration: 0,
          tracks: [],
          count: 0
        });

        $scope.mainAlbum = $scope.playlists[0];

        $.each(mainAlbum.children, function() {

          if (typeof this.type !=='undefined') {

            if (this.type === 'track') {

              if (typeof this.cover==='undefined'||this.cover===null) {
                if (typeof mainAlbum.cover!=='undefined'&&mainAlbum.cover!==null) {
                  this.cover = mainAlbum.cover;
                } else {
                  //Check for root album
                  if (typeof mainAlbum._meta!=='undefined'&&
                      typeof mainAlbum._meta.parent!=='undefined'&&
                      typeof mainAlbum._meta.parent.cover!=='undefined'&&
                      typeof mainAlbum._meta.parent.cover!==null) {
                    this.cover = mainAlbum._meta.parent.cover;
                  }
                }
              }

              track = bmmFormatterTrack.resolve(this);

              if (track.type==='video') {
                track.video = true;
              }

              $scope.$apply(function() {
                $scope.playlists[0].tracks.push(track);
                $scope.playlists[0].duration+=track.duration;
                $scope.playlists[0].count++;
              });

            } else if (this.type === 'album') {

              bmmApi.albumGet(this.id, init.mediaLanguage).done(function(album) {

                var l = $scope.playlists.length, formattedAlbum = bmmFormatterAlbum.resolve(album);

                $scope.$apply(function() {
                  $scope.playlists[l] = {
                    title: formattedAlbum.title,
                    description: formattedAlbum.description,
                    id: formattedAlbum.id,
                    cover: formattedAlbum.cover,
                    duration: 0,
                    tracks: [],
                    count: 0
                  };
                });

                $.each(album.children, function() {

                  if (this.type === 'track') {

                    if (typeof this.cover==='undefined'||this.cover===null) {
                      if (typeof album.cover!=='undefined'&&album.cover!==null) {
                        this.cover = album.cover;
                      } else {
                        //Check for root album
                        if (typeof album._meta!=='undefined'&&
                            typeof album._meta.parent!=='undefined'&&
                            typeof album._meta.parent.cover!=='undefined'&&
                            typeof album._meta.parent.cover!==null) {
                          this.cover = album._meta.parent.cover;
                        }
                      }
                    }

                    track = bmmFormatterTrack.resolve(this);

                    if (track.type==='video') {
                      track.video = true;
                    }

                    $scope.$apply(function() {
                      $scope.playlists[l].tracks.push(track);
                      $scope.playlists[l].duration+=track.duration;
                      $scope.playlists[l].count++;
                    });

                  } //If not track, dont display (will only display one level up)

                });

              });

            }

          }

        });

        if ($scope.playlists[0].count===0) {
          $scope.playlists.splice(0,1);
        }

      });

    });

    var findPlayingTrack = function() {
      if ($location.path()===bmmPlaylist.getUrl()) {

        $.each($scope.playlists, function() {
          $.each(this.tracks, function(index) {
            if (index===bmmPlaylist.index&&bmmPlaylist.getCurrent().url===this.file) {
              this.playing = true;
            } else {
              this.playing = false;
            }
          });
        });

      }
    };

    //When new track is set
    $scope.$watch('bmmPlayer.getTrackCount', function() {
      findPlayingTrack();
    });

  });
