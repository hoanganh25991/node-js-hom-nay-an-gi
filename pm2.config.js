module.exports = {
	/**
	 * Application configuration section
	 * http://pm2.keymetrics.io/docs/usage/application-declaration/
	 */
	apps : [
		// First application
		{
			name        : "order_lunch",
			script      : "server.js",
			interpreter : "node",
			// instances   : 1,
			// exec_mode   : "cluster"
		},
	],
}