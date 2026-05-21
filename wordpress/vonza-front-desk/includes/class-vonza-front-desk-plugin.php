<?php
/**
 * Core plugin bootstrap and shared option helpers.
 *
 * @package VonzaFrontDesk
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vonza_Front_Desk_Plugin {
	const OPTION_NAME = 'vonza_front_desk_options';
	const DEFAULT_APP_URL = 'https://vonza-assistant.onrender.com';

	/**
	 * Singleton instance.
	 *
	 * @var Vonza_Front_Desk_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Renderer instance.
	 *
	 * @var Vonza_Front_Desk_Renderer|null
	 */
	private $renderer = null;

	/**
	 * Admin instance.
	 *
	 * @var Vonza_Front_Desk_Admin|null
	 */
	private $admin = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	public function init() {
		$this->renderer = new Vonza_Front_Desk_Renderer( $this );
		$this->renderer->init();

		if ( is_admin() ) {
			$this->admin = new Vonza_Front_Desk_Admin( $this );
			$this->admin->init();
		}
	}

	public function get_options() {
		$stored = get_option( self::OPTION_NAME, array() );
		return wp_parse_args( is_array( $stored ) ? $stored : array(), $this->get_default_options() );
	}

	public function get_default_options() {
		return array(
			'agent_id'             => '',
			'app_url'              => self::DEFAULT_APP_URL,
			'enable_widget'        => '0',
			'default_page_mode'    => 'page-takeover',
			'surface'              => 'flat',
			'background_coverage'  => 'page',
			'hide_page_footer'     => '1',
			'hide_page_title'      => '0',
			'created_page_id'      => 0,
		);
	}

	public function save_options( $options ) {
		update_option( self::OPTION_NAME, $this->sanitize_options( $options ), false );
	}

	public function sanitize_options( $input ) {
		$current = $this->get_options();
		$input   = is_array( $input ) ? $input : array();

		$app_url = esc_url_raw( $input['app_url'] ?? $current['app_url'] );
		if ( empty( $app_url ) || ! wp_http_validate_url( $app_url ) ) {
			$app_url = self::DEFAULT_APP_URL;
		}

		return array(
			'agent_id'             => $this->sanitize_agent_id( $input['agent_id'] ?? $current['agent_id'] ),
			'app_url'              => untrailingslashit( $app_url ),
			'enable_widget'        => empty( $input['enable_widget'] ) ? '0' : '1',
			'default_page_mode'    => $this->sanitize_choice( $input['default_page_mode'] ?? $current['default_page_mode'], array( 'section', 'page-takeover' ), 'page-takeover' ),
			'surface'              => $this->sanitize_choice( $input['surface'] ?? $current['surface'], array( 'flat', 'card' ), 'flat' ),
			'background_coverage'  => $this->sanitize_choice( $input['background_coverage'] ?? $current['background_coverage'], array( 'section', 'page' ), 'page' ),
			'hide_page_footer'     => empty( $input['hide_page_footer'] ) ? '0' : '1',
			'hide_page_title'      => empty( $input['hide_page_title'] ) ? '0' : '1',
			'created_page_id'      => absint( $input['created_page_id'] ?? $current['created_page_id'] ),
		);
	}

	public function sanitize_agent_id( $value ) {
		$value = sanitize_text_field( wp_unslash( $value ) );
		return preg_match( '/^[A-Za-z0-9._:-]{0,200}$/', $value ) ? $value : '';
	}

	public function sanitize_bool_string( $value, $default = false ) {
		$value = strtolower( sanitize_text_field( (string) $value ) );

		if ( in_array( $value, array( '1', 'true', 'yes', 'on' ), true ) ) {
			return true;
		}

		if ( in_array( $value, array( '0', 'false', 'no', 'off' ), true ) ) {
			return false;
		}

		return (bool) $default;
	}

	public function sanitize_choice( $value, $allowed, $fallback ) {
		$value = sanitize_key( (string) $value );
		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	public function get_created_page() {
		$options = $this->get_options();
		$page_id = absint( $options['created_page_id'] );

		if ( $page_id ) {
			$page = get_post( $page_id );
			if ( $page && 'page' === $page->post_type && 'trash' !== $page->post_status ) {
				return $page;
			}
		}

		$page = get_page_by_path( 'front-desk', OBJECT, 'page' );
		return ( $page && 'trash' !== $page->post_status ) ? $page : null;
	}
}
