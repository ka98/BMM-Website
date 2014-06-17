'use strict';

angular.module('bmmApp')
  .controller('MusicCtrl', function (
    $scope,
    $timeout,
    bmmApi,
    bmmFormatterTrack,
    bmmFormatterAlbum,
    init,
    draggable
  ) {

    $(window).off('scrollBottom');

    var albumFrom = 0, loading=true, end=false, loadAmount=84;

    $(window).on('scrollBottom', function() {

      if (!loading&&!end) {

        $('[ng-view]').append('<div class="bmm-loading">'+init.translation.general.loading+'</div>');

        var cnt = 0;
        loading = true;

        //LATEST AUDIO ALBUMS
        bmmApi.albumLatest({
          from: albumFrom,
          size: loadAmount,
          'content-type': ['song'],
          'media-type': ['audio']
        }, init.mediaLanguage).done(function(data) {

          $.each(data, function() {

            $scope.latestAlbums.push(bmmFormatterAlbum.resolve(this));
            albumFrom++;
            cnt++;

          });

          $scope.$apply();

          loading = false;
          $('.bmm-loading').remove();

          if (cnt<loadAmount) { end = true; }

        });

      }

    });

    //AUTOCOMPLETION
    $scope.$watch('contributor', function(name) {
      if (name!==''&&typeof name!=='undefined') {
        bmmApi.contributorSuggesterCompletionGet(name).done(function(data) {
          $scope.$apply(function() {
            $scope.contributors = data;
          });
        });
      } else {
        $scope.contributors = $scope.randomArtists;
      }
    });

    //LATEST MUSIC
    bmmApi.trackLatest({
      size: 15,
      'content-type': ['song'],
      'media-type': ['audio']
    }, init.mediaLanguage).done(function(data) {

      var left = [], right = [], largeOnly = [];

      $.each(data, function(index) {

        if (index<5) {
          left.push(bmmFormatterTrack.resolve(this));
        } else if (index<10) {
          right.push(bmmFormatterTrack.resolve(this));
        } else {
          largeOnly.push(bmmFormatterTrack.resolve(this));
        }

      });

      $scope.$apply(function() {
        $scope.latestMusicLeft = left;
        $scope.latestMusicRight = right;
        $scope.latestLargeOnly = largeOnly;
        draggable.makeDraggable($scope);
      });

    });

    //LATEST AUDIO ALBUMS
    bmmApi.albumLatest({
      size: loadAmount,
      'content-type': ['song'],
      'media-type': ['audio']
    }, init.mediaLanguage).done(function(data) {

      var albums=[];

      $.each(data, function() {

        albums.push(bmmFormatterAlbum.resolve(this));
        albumFrom++;

      });

      $scope.$apply(function() {
        $scope.latestAlbums = albums;
      });

      loading=false;

    });

    $scope.randomArtists = [];

    //4 will randomly be selected and shown
    var randomBrothers = [
      65224, //Jermund Pedersen
      59268, //Astrid Reinhardt
      45275, //Gjermund Frivold
      81631, //Rebekka Frivold
      75152, //Elisa Frivold
      59596, //Oliver Tangen
      43806, //Alise Helgheim
      64808, //Pia Veronica Jacobsen
      80142, //Pia Gjøsund
      41600, //Dag Helge Bernhardsen
      60455, //Atle Johnsen
      51294, //Hanne Trinkle
      41576, //Ingrid Holm Andersen
      41598, //Jostein Østmoen
      49935, //Karethe Opitz
      49933, //Kristiane Opitz
      45272, //Linn Helgheim
      41622, //Liv Ragnhild Fotland
      60845, //Marte Hannson
      60844  //Vegar Sandberg
    ];

    //Randomize function
    var shuffle = function(o) {
      for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x){}
      return o;
    };

    //Catch 4 contributors
    randomBrothers = shuffle(randomBrothers);
    $.each(randomBrothers, function(index) {

      bmmApi.contributorIdGet(this).done(function(data) {

        if (data.cover!==null) {
          data.cover = bmmApi.secureFile(data.cover);
        }

        $scope.randomArtists.push(data);
        $scope.$apply();
        $scope.contributors = $scope.randomArtists;
      });
      if (index===3) {
        return false;
      }
    });

  });
