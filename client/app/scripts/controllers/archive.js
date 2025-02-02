'use strict';

angular.module('bmmApp')
  .controller('ArchiveCtrl', function (
    $scope,
    $location,
    $window,
    _api,
    _init,
    _track,
    _album,
    _play,
    _draggable
  ) {

    $(window).off('scrollBottom');

    //FETCH ALL YEARS WHERE TRACKS WHERE RECORDED
    _api.facetsTrackRecordedYears().done(function(data) {

      $scope.roleList = [];

      $.each(data, function() {

        $scope.roleList.push({
          roleName : this.year,
          roleId: this.year,
          collapsed: true,
          group: 'year',
          loadAttempt: false,
          children: []
        });

      });

      $scope.roleList.reverse();

    });

    //OPEN SELECTED TRACK / ALBUM
    $scope.$watch( 'tree.currentNode', function() {

      if( $scope.tree && angular.isObject($scope.tree.currentNode) ) {

        if ($scope.tree.currentNode.group==='album') {

          $location.path( '/album/'+$scope.tree.currentNode.roleId );

        } else if ($scope.tree.currentNode.group==='track') {

          _api.trackGet(
            $scope.tree.currentNode.roleId).done(function(track) {

              track = _track.resolve(track);
              _play.setPlay([track], 0);

            });

        }

      }

    });

    //EXPAND ARCHIVE WITH NEW DATA
    $scope.$watch( 'tree.expandedNode', function() {

      if( $scope.tree && angular.isObject($scope.tree.expandedNode) ) {

        if ($scope.tree.expandedNode.group==='track') {
          _api.trackGet(
            $scope.tree.expandedNode.roleId).done(function(track) {

              track = _track.resolve(track);
              _play.setPlay([track], 0);

            });

        } else if (!$scope.tree.expandedNode.loadAttempt) {

          $scope.tree.expandedNode.loadAttempt = true;

          //IF A YEAR IS OPENED, DISPLAY ALBUMS FOR THE WHOLE YEAR
          if ($scope.tree.expandedNode.group==='year') {

            _api.albumTracksRecordedYear($scope.tree.expandedNode.roleId, {}).done(function(data) {

              $scope.tree.expandedNode.children = [];
              $.each(data, function() {

                $scope.tree.expandedNode.children.push({
                  roleName : this.title,
                  roleId: this.id,
                  collapsed: true,
                  group: 'album',
                  loadAttempt: false,
                  children: []
                });

              });
              _draggable.makeDraggable($scope);

            });

          }

          //IF AN ALBUM IS OPENED, DISPLAY SUB ALBUMS AND TRACKS
          if ($scope.tree.expandedNode.group==='album') {

            _api.albumGet(
              $scope.tree.expandedNode.roleId
            ).done(function(data) {

              var albums = [], tracks = [];

              $.each(data.children, function() {

                if (typeof this.type!=='undefined') {
                  if (this.type==='album') {
                    albums.push(_album.resolve(this));
                  } else if (this.type==='track') {
                    tracks.push(_track.resolve(this));
                  }
                }

              });

              $scope.tree.expandedNode.children = [];

              $.each(tracks, function() {

                $scope.tree.expandedNode.children.push({
                  roleName : this.combinedTitle,
                  roleId: this.id,
                  language: this.language,
                  collapsed: true,
                  group: 'track',
                  loadAttempt: false
                });

              });

              $.each(albums, function() {

                $scope.tree.expandedNode.children.push({
                  roleName : this.title,
                  roleId: this.id,
                  collapsed: true,
                  group: 'album',
                  loadAttempt: false,
                  children: []
                });

              });

              _draggable.makeDraggable($scope);

            });

          }

        }

      }
    }, false);

  });
