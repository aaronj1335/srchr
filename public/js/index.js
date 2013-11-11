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
  var template = _.template($('#template').html());
  var $results = $('.results');
  var $loading = $('.loading');
  var $search = $('form[name=search] [type=search]')
      .on('keyup change', _.debounce(function() {
        var val = $(this).val();

        if (val && val.length > 2 && val !== store.term) {
          store.term = val;
          store.trigger('change:term', store.term);

          store.search = api.fetch(val)
            .then(function(result) {
              store.data = result;
              store.trigger('change:results', store.data);
            })
            .always(function() {
              store.trigger('search-stop');
            });

          store.trigger('search-start');
        }
      }, 300));

  store
    .on('change:results', function(evt, data) {
      $results.html(template({data: data, term: store.term}));
    })
    .on('search-start', function() {
      $loading.text('Loading...');
    })
    .on('search-stop', function() {
      if (store.search.state() !== 'pending') {
        $loading.text('');
      }
    });

  $('body').on('keyup', function(evt) {
    if (evt.which === 191 && !$(':focus').length) {
      $search.focus();
    }
  });

  $('[type=search]').val('apple');
})();
