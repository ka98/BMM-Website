'use strict';

angular.module('bmmApp')
  .controller('PodcastsCtrl', function(
    $scope,
    _api,
    _init
  ) {
  $scope.init = _init;

  $scope.save = function() {
    var podcastReferences = $scope.activePodcasts.map(function(podcast) {
      return { id: podcast.id };
    });

    var podcastCollection = {
      type: 'podcast_collection',
      podcast_references: podcastReferences
    };

    _api.activePodcastsPut(podcastCollection);
  };

  $scope.deactivatePodcast = function(podcast) {
    var activePodcasts = $scope.activePodcasts;
    var availablePodcasts = $scope.availablePodcasts;

    var index = activePodcasts.indexOf(podcast);

    var disabledPodcasts = activePodcasts.splice(index, 1);

    availablePodcasts.push.apply(availablePodcasts, disabledPodcasts);
  };

  $scope.activatePodcast = function(podcast) {
    var activePodcasts = $scope.activePodcasts;
    var availablePodcasts = $scope.availablePodcasts;

    var index = availablePodcasts.indexOf(podcast);

    var activatedPodcasts = availablePodcasts.splice(index, 1);

    activePodcasts.push.apply(activePodcasts, activatedPodcasts);
  };

  $scope.deletePodcast = function(podcast) {
    _api.podcastIdDelete(podcast.id)
      .then(function() {
        var index = $scope.availablePodcasts.indexOf(podcast);
        $scope.availablePodcasts.splice(index, 1);
      });
  };

  _api.podcastsGet().then(function(podcasts) {
    $scope.activePodcasts = podcasts;
  });

  _api.unpublishedPodcastsGet().then(function(podcasts) {
    $scope.availablePodcasts = podcasts;
  });

  $scope.sortableOptions = {
    axis: 'y',
    handle: '.sort_handle',
    'ui-floating': false
  };
});
