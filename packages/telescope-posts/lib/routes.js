Posts.controllers = {};

// Controller for all posts lists

Posts.controllers.list = RouteController.extend({

  template: 'posts_list',

  onBeforeAction: function () {
    var showViewsNav = (typeof this.showViewsNav === 'undefined') ? true : this.showViewsNav;

    if (showViewsNav) {
      this.render('postListTop', {to: 'postListTop'});
    }
    this.next();
  },

  subscriptions: function () {
    // take the first segment of the path to get the view, unless it's '/' in which case the view default to 'top'
    // note: most of the time this.params.slug will be empty
    this._terms = {
      view: this.view,
      limit: this.params.limit || Settings.get('postsPerPage', 10),
      category: this.params.slug
    };

    if(Meteor.isClient) {
      this._terms.query = Session.get("searchQuery");
    }

    this.postsListSub = coreSubscriptions.subscribe('postsList', this._terms);
    this.postsListUsersSub = coreSubscriptions.subscribe('postsListUsers', this._terms);
  },

  data: function () {

    if(Meteor.isClient) {
      this._terms.query = Session.get("searchQuery");
    }

    var parameters = Posts.getSubParams(this._terms),
      postsCount = Posts.find(parameters.find, parameters.options).count();

    parameters.find.createdAt = { $lte: Session.get('listPopulatedAt') };
    var posts = Posts.find(parameters.find, parameters.options);

    // Incoming posts
    parameters.find.createdAt = { $gt: Session.get('listPopulatedAt') };
    var postsIncoming = Posts.find(parameters.find, parameters.options);

    Session.set('postsLimit', this._terms.limit);

    return {
      title: this.getTitle(),
      incoming: postsIncoming,
      postsCursor: posts,
      postsCount: postsCount,
      postsReady: this.postsListSub.ready(),
      hasMorePosts: this._terms.limit == postsCount,
      loadMoreHandler: function () {

        var count = parseInt(Session.get('postsLimit')) + parseInt(Settings.get('postsPerPage', 10));
        var categorySegment = Session.get('categorySlug') ? Session.get('categorySlug') + '/' : '';

        // TODO: use Router.path here?
        Router.go('/' + Session.get('view') + '/' + categorySegment + count);
      }
    };
  },

  getTitle: function () {
    return i18n.t(this.view);
  },

  getDescription: function () {
    if (Router.current().route.getName() == 'posts_default') { // return site description on root path
      return Settings.get('description');
    } else {
      return i18n.t(_.findWhere(Telescope.menus.get("viewsMenu"), {label: this.view}).description);
    }
  },

  onAfterAction: function() {
    Session.set('view', this.view);
  },

  fastRender: true
});

var getDefaultViewController = function () {
  var defaultView = Settings.get('defaultView', 'top');
  return Posts.controllers[defaultView];
};

// wrap in startup block to make sure Settings collection is defined
Meteor.startup(function () {
  Posts.controllers.default = getDefaultViewController().extend({
    getTitle: function () {
      var title = Settings.get('title', 'Telescope');
      var tagline = Settings.get('tagline');
      var fullTitle = !!tagline ? title + ' – ' + tagline : title ;
      return fullTitle;
    }
  });

});

Posts.controllers.top = Posts.controllers.list.extend({
  view: 'top',
});

Posts.controllers.new = Posts.controllers.list.extend({
  view: 'new'
});

Posts.controllers.best = Posts.controllers.list.extend({
  view: 'best'
});

Posts.controllers.view = Posts.controllers.list.extend({
  view: 'pending'
});

Posts.controllers.scheduled = Posts.controllers.list.extend({
  view: 'scheduled'
});

// Controller for post pages

Posts.controllers.page = RouteController.extend({

  template: 'post_page',

  waitOn: function() {
    this.postSubscription = coreSubscriptions.subscribe('singlePost', this.params._id);
    this.postUsersSubscription = coreSubscriptions.subscribe('postUsers', this.params._id);
    this.commentSubscription = coreSubscriptions.subscribe('postComments', this.params._id);
  },

  post: function() {
    return Posts.findOne(this.params._id);
  },

  getTitle: function () {
    if (!!this.post())
      return this.post().title;
  },

  onBeforeAction: function() {
    if (! this.post()) {
      if (this.postSubscription.ready()) {
        this.render('not_found');
      } else {
        this.render('loading');
      }
    } else {
      this.next();
    }
  },

  onRun: function() {
    var sessionId = Meteor.default_connection && Meteor.default_connection._lastSessionId ? Meteor.default_connection._lastSessionId : null;
    Meteor.call('increasePostViews', this.params._id, sessionId);
    this.next();
  },

  data: function() {
    return this.post();
  },
  fastRender: true
});

Meteor.startup(function () {

  Router.route('/', {
    name: 'posts_default',
    controller: Posts.controllers.default
  });

  Router.route('/top/:limit?', {
    name: 'posts_top',
    controller: Posts.controllers.top
  });

  // New

  Router.route('/new/:limit?', {
    name: 'posts_new',
    controller: Posts.controllers.new
  });

  // Best

  Router.route('/best/:limit?', {
    name: 'posts_best',
    controller: Posts.controllers.best
  });

  // Pending

  Router.route('/pending/:limit?', {
    name: 'posts_pending',
    controller: Posts.controllers.pending
  });

  // Scheduled

  Router.route('/scheduled/:limit?', {
    name: 'posts_scheduled',
    controller: Posts.controllers.scheduled
  });

  // Post Page

  Router.route('/posts/:_id', {
    name: 'post_page',
    controller: Posts.controllers.page
  });

  Router.route('/posts/:_id/comment/:commentId', {
    name: 'post_page_comment',
    controller: Posts.controllers.page,
    onAfterAction: function () {
      // TODO: scroll to comment position
    }
  });

  // Post Edit

  Router.route('/posts/:_id/edit', {
    name: 'post_edit',
    template: 'post_edit',
    waitOn: function () {
      return [
        coreSubscriptions.subscribe('singlePost', this.params._id),
        coreSubscriptions.subscribe('allUsersAdmin')
      ];
    },
    data: function() {
      return {
        postId: this.params._id,
        post: Posts.findOne(this.params._id)
      };
    },
    fastRender: true
  });

  // Post Submit

  Router.route('/submit', {
    name: 'post_submit',
    template: 'post_submit',
    waitOn: function () {
      return coreSubscriptions.subscribe('allUsersAdmin');
    }
  });

});
