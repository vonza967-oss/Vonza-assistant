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
	const FRONT_DESK_PAGE_META = '_vonza_front_desk_page';

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

		add_filter( 'template_include', array( $this, 'filter_template_include' ) );
		add_filter( 'body_class', array( $this, 'filter_body_classes' ) );

		if ( is_admin() ) {
			$this->admin = new Vonza_Front_Desk_Admin( $this );
			$this->admin->init();
		}
	}

	public function get_options() {
		$stored = get_option( self::OPTION_NAME, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$has_front_desk_page_id = array_key_exists( 'front_desk_page_id', $stored );
		$options = wp_parse_args( $stored, $this->get_default_options() );

		$options['front_desk_page_id'] = absint( $options['front_desk_page_id'] );
		$options['created_page_id'] = absint( $options['created_page_id'] );

		if ( ! $has_front_desk_page_id && empty( $options['front_desk_page_id'] ) && ! empty( $options['created_page_id'] ) ) {
			$options['front_desk_page_id'] = $options['created_page_id'];
		}

		return $options;
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
			'hide_page_title'      => '1',
			'front_desk_page_mode' => 'template',
			'front_desk_page_id'   => 0,
			'created_page_id'      => 0,
			'front_desk_page_title' => __( 'Front Desk', 'vonza-front-desk' ),
			'front_desk_page_slug' => 'front-desk',
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

		$front_desk_page_id = $this->sanitize_front_desk_page_id( $input['front_desk_page_id'] ?? $current['front_desk_page_id'] );
		$created_page_id = array_key_exists( 'front_desk_page_id', $input )
			? $front_desk_page_id
			: $this->sanitize_front_desk_page_id( $input['created_page_id'] ?? $current['created_page_id'] );

		$page_title = sanitize_text_field( $input['front_desk_page_title'] ?? $current['front_desk_page_title'] );
		if ( '' === $page_title ) {
			$page_title = __( 'Front Desk', 'vonza-front-desk' );
		}

		$page_slug = sanitize_title( $input['front_desk_page_slug'] ?? $current['front_desk_page_slug'] );
		if ( '' === $page_slug ) {
			$page_slug = 'front-desk';
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
			'front_desk_page_mode' => $this->sanitize_choice( $input['front_desk_page_mode'] ?? $current['front_desk_page_mode'], array( 'template', 'shortcode' ), 'template' ),
			'front_desk_page_id'   => $front_desk_page_id,
			'created_page_id'      => $created_page_id,
			'front_desk_page_title' => $page_title,
			'front_desk_page_slug' => $page_slug,
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

	public function sanitize_front_desk_page_id( $value ) {
		$page_id = absint( $value );
		if ( empty( $page_id ) ) {
			return 0;
		}

		$page = get_post( $page_id );
		if ( ! $page || 'page' !== $page->post_type || ! in_array( $page->post_status, array( 'publish', 'draft' ), true ) ) {
			return 0;
		}

		return $page_id;
	}

	public function get_created_page() {
		return $this->get_front_desk_page();
	}

	public function get_front_desk_page() {
		$options = $this->get_options();
		$page_id = absint( $options['front_desk_page_id'] );

		if ( $page_id ) {
			$page = get_post( $page_id );
			if ( $page && 'page' === $page->post_type && 'trash' !== $page->post_status ) {
				return $page;
			}
		}

		return null;
	}

	public function is_front_desk_page() {
		if ( is_admin() || ! is_page() ) {
			return false;
		}

		$current_page_id = absint( get_queried_object_id() );
		return $current_page_id && in_array( $current_page_id, $this->get_front_desk_page_ids(), true );
	}

	private function get_front_desk_page_ids() {
		$options = $this->get_options();
		$page_ids = array(
			absint( $options['front_desk_page_id'] ),
			absint( $options['created_page_id'] ),
		);

		return array_values( array_unique( array_filter( $page_ids ) ) );
	}

	public function filter_template_include( $template ) {
		$options = $this->get_options();

		if ( 'template' !== $options['front_desk_page_mode'] || ! $this->is_front_desk_page() ) {
			return $template;
		}

		$front_desk_template = $this->get_front_desk_template_path();
		return file_exists( $front_desk_template ) ? $front_desk_template : $template;
	}

	public function filter_body_classes( $classes ) {
		if ( ! $this->is_front_desk_page() ) {
			return $classes;
		}

		$classes[] = 'vonza-front-desk-page';

		$options = $this->get_options();
		if ( 'template' === $options['front_desk_page_mode'] ) {
			$classes[] = 'vonza-front-desk-template-active';
		}

		return array_values( array_unique( $classes ) );
	}

	public function get_front_desk_template_path() {
		return VONZA_FRONT_DESK_DIR . 'templates/front-desk-page-template.php';
	}
}
