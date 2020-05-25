/* Magic Mirror
 * Node Helper: Newsfeed
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const validUrl = require("valid-url");
const Fetcher = require("./fetcher.js");
const Logger = require("../../../js/logger");

module.exports = NodeHelper.create({
	// Override start method.
	start: function () {
		Logger.log("Starting node helper for: " + this.name);
		this.fetchers = [];
	},

	// Override socketNotificationReceived received.
	socketNotificationReceived: function (notification, payload) {
		if (notification === "ADD_FEED") {
			this.createFetcher(payload.feed, payload.config);
		}
	},

	/* createFetcher(feed, config)
	 * Creates a fetcher for a new feed if it doesn't exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * attribute feed object - A feed object.
	 * attribute config object - A configuration object containing reload interval in milliseconds.
	 */
	createFetcher: function (feed, config) {
		var self = this;

		var url = feed.url || "";
		var encoding = feed.encoding || "UTF-8";
		var reloadInterval = feed.reloadInterval || config.reloadInterval || 5 * 60 * 1000;

		if (!validUrl.isUri(url)) {
			self.sendSocketNotification("INCORRECT_URL", url);
			return;
		}

		var fetcher;
		if (typeof self.fetchers[url] === "undefined") {
			Logger.log("Create new news fetcher for url: " + url + " - Interval: " + reloadInterval);
			fetcher = new Fetcher(url, reloadInterval, encoding, config.logFeedWarnings);

			fetcher.onReceive(function (fetcher) {
				self.broadcastFeeds();
			});

			fetcher.onError(function (fetcher, error) {
				self.sendSocketNotification("FETCH_ERROR", {
					url: fetcher.url(),
					error: error
				});
			});

			self.fetchers[url] = fetcher;
		} else {
			Logger.log("Use existing news fetcher for url: " + url);
			fetcher = self.fetchers[url];
			fetcher.setReloadInterval(reloadInterval);
			fetcher.broadcastItems();
		}

		fetcher.startFetch();
	},

	/* broadcastFeeds()
	 * Creates an object with all feed items of the different registered feeds,
	 * and broadcasts these using sendSocketNotification.
	 */
	broadcastFeeds: function () {
		var feeds = {};
		for (var f in this.fetchers) {
			feeds[f] = this.fetchers[f].items();
		}
		this.sendSocketNotification("NEWS_ITEMS", feeds);
	}
});
