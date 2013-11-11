/*global $,_,moment*/
(function() {
  var store = $({});
  var api = {
    fetch: function(searchString) {
      return $.ajax({
          type: 'GET',
          url: '/api',
          headers: {'Accept': 'application/json'},
          data: {q: searchString}
        })
        .then(function(response) {
          _.each(response, function(results) {
            _.each(results, function(result) {
              result.sent = moment(result.sent);
            });
          });

          return response;
        });
    }
  };
  var template = _.template($('#template').html(), null, {variable: 'data'});
  var $results = $('.results');
  var $loading = $('.loading');

  $('form[name=search]')
    .find('input')
      .on('keyup', _.debounce(function() {
        var val = $(this).val();

        if (val && val.length > 2) {
          store.search = api.fetch(val)
            .then(function(result) {
              store.data = result;
              store.trigger('change', store.data);
            })
            .always(function() {
              store.trigger('search-stop');
            });

          store.trigger('search-start');
        }
      }, 300));

  store
    .on('change', function(evt, data) {
      $results.html(template(data));
    })
    .on('search-start', function() {
      $loading.text('Loading...');
    })
    .on('search-stop', function() {
      if (store.search.state() !== 'pending') {
        $loading.text('');
      }
    });

  $('[type=search]').val('apple').trigger('keyup');
})();
