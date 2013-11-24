/*global $,_,moment*/
(function() {
  var results, viewing;

  function Model(initialValues) {
    this._events = $({});
    _.extend(this, initialValues);
  }

  ['on', 'off', 'one', 'trigger'].forEach(function(evt) {
    Model.prototype[evt] = function() {
      return this._events[evt].apply(this._events, arguments);
    };
  });

  Model.prototype.set = function(key, val) {
    this[key] = val;
    this.trigger('change', key, val);
  };

  Model.prototype.get = function(key) {
    return this[key];
  };

  Model.prototype.computed = function(prop, deps, getter) {
    getter = getter.bind(this);

    this.on('change', function(evt, changedProp) {
      if (deps.indexOf(changedProp) > -1)
        this.trigger('change', prop, getter);
    }.bind(this));

    Object.defineProperty(this, prop, {get: getter});
  };

  var model = window.model = new Model({
    data: null,
    sort: 'ap',
    engines: ['solr', 'sphinx', 'mongo', 'google'],
    viewing: ['solr', 'sphinx', 'mongo', 'google']
  });

  model.computed('results', ['data'], function() {
    var viewing = this.get('viewing');

    return _.filter(this.get('data'), function(result) {
      return viewing.indexOf(result.engine) >= 0;
    });
  });

  model.computed('notViewing', ['viewing'], function() {
    return _.difference(_.keys(strings.engines), this.get('viewing'));
  });

  model.computed('performanceResults', ['data', 'sort'], function() {
    var notGoogle = _.filter(this.get('data'), function(result) {
      return result.engine !== 'google';
    });
    return _.sortBy(notGoogle, this.get('sort')).reverse();
  });

  var strings = {
    engines: {
      solr: 'Lucene',
      sphinx: 'Sphinx',
      mongo: 'MongoDB',
      google: 'Google'
    }
  };

  function View(initialValues) {
    _.extend(this, initialValues);
    if (this.el)
      this.$el = $(this.el), this.el = this.$el[0];
    if (this.template)
      this.template = _.template(this.template);
    this.render();
  }

  View.prototype.render = function() {
    if (this.$el && this.template)
      this.$el.html(this.template({strings: this.strings, model: this.model}));
  };

  View.prototype.model = model;
  View.prototype.strings = strings;

  function ResultsView() {
    View.apply(this, arguments);
    this.model.on('change', function(evt, prop) {
      if (prop in {data:true, viewing:true, sort:true})
        this.render();
    }.bind(this));
    this.$el.on('click', '[data-sort]', function(evt) {
      this.model.set('sort', $(evt.target).data('sort'));
    }.bind(this));
  }

  ResultsView.prototype = new View();

  function ViewingView() {
    View.apply(this, arguments);
    this.model.on('change', function(evt, prop) {
      if (prop === 'viewing')
        this.render();
    }.bind(this));
  }

  ViewingView.prototype = new View();

  ViewingView.prototype.render = function() {
    var focus = this.$el.find(':focus').attr('name');
    View.prototype.render.apply(this, arguments);
    if (focus)
      this.$el.find('[name=' + focus + ']').focus();
  };

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
            _.each(results.docs, function(result) {
              result.sent = moment(result.sent);
            });
          });

          return response;
        });
    }
  };

  results = new ResultsView({
    el: $('.results'),
    template: $('#results').html()
  });

  viewing = new ViewingView({
    el: $('.viewing'),
    template: $('#viewing').html()
  });

  var $loading = $('.loading');
  var $search = $('[type=search]');
  $('body')
    .on('keyup change', '[type=search]', _.debounce(function() {
      var val = $(this).val();

      if (val && val.length > 2 && val !== model.get('term')) {
        model.set('term', val);

        model.set('search', api.fetch(val)
          .then(function(result) {
            model.set('data', result);
          })
          .always(function() {
            model.trigger('search-stop');
          }));

        model.trigger('search-start');
      }
    }, 300))
    .on('change', '[type=checkbox]', function() {
      var viewing = $(this).closest('.viewing')
        .find('[type=checkbox]:checked')
        .map(function(i, el) {
          return $(el).val();
        });

      model.set('viewing', _.toArray(viewing));
    });

  model
    .on('search-start', function() {
      $loading.removeClass('invisible');
    })
    .on('search-stop', function() {
      if (model.get('search').state() !== 'pending')
        $loading.addClass('invisible');
    });

  $('body').on('keyup', function(evt) {
    if (evt.which === 191 && !$(':focus').length)
      $search.focus();
  });

  $('[type=search]').val('apple').trigger('change');
})();
