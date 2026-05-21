<?php
/**
 * Plugin Name: Vonza Front Desk
 * Description: Add the Vonza AI Front Desk to your WordPress website.
 * Version: 0.1.0
 * Author: Vonza
 * Text Domain: vonza-front-desk
 *
 * @package VonzaFrontDesk
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VONZA_FRONT_DESK_VERSION', '0.1.0' );
define( 'VONZA_FRONT_DESK_FILE', __FILE__ );
define( 'VONZA_FRONT_DESK_DIR', plugin_dir_path( __FILE__ ) );
define( 'VONZA_FRONT_DESK_URL', plugin_dir_url( __FILE__ ) );

require_once VONZA_FRONT_DESK_DIR . 'includes/class-vonza-front-desk-plugin.php';
require_once VONZA_FRONT_DESK_DIR . 'includes/class-vonza-front-desk-renderer.php';
require_once VONZA_FRONT_DESK_DIR . 'includes/class-vonza-front-desk-admin.php';

add_action(
	'plugins_loaded',
	static function () {
		Vonza_Front_Desk_Plugin::instance()->init();
	}
);
