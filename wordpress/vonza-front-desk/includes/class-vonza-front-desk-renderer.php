<?php
/**
 * Frontend shortcode and widget rendering.
 *
 * @package VonzaFrontDesk
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vonza_Front_Desk_Renderer {
	/**
	 * Plugin helper.
	 *
	 * @var Vonza_Front_Desk_Plugin
	 */
	private $plugin;

	/**
	 * Whether embed.js has already been printed for this request.
	 *
	 * @var bool
	 */
	private $widget_rendered = false;

	/**
	 * Whether page takeover scoped CSS has already been printed.
	 *
	 * @var bool
	 */
	private $takeover_css_printed = false;

	public function __construct( Vonza_Front_Desk_Plugin $plugin ) {
		$this->plugin = $plugin;
	}

	public function init() {
		add_shortcode( 'vonza_front_desk', array( $this, 'render_front_desk_shortcode' ) );
		add_shortcode( 'vonza_widget', array( $this, 'render_widget_shortcode' ) );
		add_action( 'wp_footer', array( $this, 'render_site_wide_widget' ), 20 );
	}

	public function render_front_desk_shortcode( $atts ) {
		$options = $this->plugin->get_options();
		$atts    = shortcode_atts(
			array(
				'layout'           => $options['default_page_mode'],
				'surface'          => $options['surface'],
				'background_scope' => $options['background_coverage'],
				'hide_footer'      => $options['hide_page_footer'],
				'hide_title'       => $options['hide_page_title'],
				'agent_id'         => '',
			),
			$atts,
			'vonza_front_desk'
		);

		$agent_id = $this->plugin->sanitize_agent_id( $atts['agent_id'] ?: $options['agent_id'] );
		if ( empty( $agent_id ) ) {
			return current_user_can( 'manage_options' )
				? '<p class="vonza-front-desk-notice">' . esc_html__( 'Vonza Front Desk is missing an Agent ID.', 'vonza-front-desk' ) . '</p>'
				: '';
		}

		$layout = $this->plugin->sanitize_choice( $atts['layout'], array( 'section', 'full-page', 'page-takeover' ), 'section' );
		$surface = $this->plugin->sanitize_choice( $atts['surface'], array( 'flat', 'card' ), 'flat' );
		$background_scope = $this->plugin->sanitize_choice( $atts['background_scope'], array( 'section', 'page', 'iframe' ), 'section' );
		$hide_footer = $this->plugin->sanitize_bool_string( $atts['hide_footer'], '1' === $options['hide_page_footer'] );
		$hide_title = $this->plugin->sanitize_bool_string( $atts['hide_title'], '1' === $options['hide_page_title'] );

		if ( 'full-page' === $layout ) {
			$surface = 'flat';
			$background_scope = 'section';
		}

		if ( 'page-takeover' === $layout ) {
			$surface = 'flat';
			$background_scope = 'page';
			$this->enqueue_takeover_css( $hide_footer, $hide_title );
		}

		wp_enqueue_script(
			'vonza-assistant-embed',
			esc_url_raw( trailingslashit( $options['app_url'] ) . 'assistant-embed.js' ),
			array(),
			VONZA_FRONT_DESK_VERSION,
			true
		);

		$attrs = array(
			'data-vonza-assistant' => '',
			'data-agent-id'        => $agent_id,
			'data-layout'          => $layout,
		);

		if ( 'section' !== $layout ) {
			$attrs['data-surface'] = $surface;
			$attrs['data-background-scope'] = $background_scope;
		}

		if ( 'page-takeover' === $layout ) {
			$attrs['data-page-reset'] = 'true';

			if ( $hide_footer ) {
				$attrs['data-hide-page-footer'] = 'true';
			}

			if ( $hide_title ) {
				$attrs['data-hide-page-title'] = 'true';
			}
		}

		return sprintf(
			'<div class="%1$s"%2$s></div>',
			esc_attr( 'page-takeover' === $layout ? 'vonza-front-desk-page-takeover' : 'vonza-front-desk-embed' ),
			$this->build_html_attributes( $attrs )
		);
	}

	public function render_widget_shortcode() {
		return $this->render_widget_script();
	}

	public function render_site_wide_widget() {
		$options = $this->plugin->get_options();

		if ( is_admin() || $this->plugin->is_front_desk_page() || '1' !== $options['enable_widget'] || $this->widget_rendered ) {
			return;
		}

		echo $this->render_widget_script(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	private function render_widget_script() {
		$options = $this->plugin->get_options();
		$agent_id = $this->plugin->sanitize_agent_id( $options['agent_id'] );

		if ( empty( $agent_id ) || $this->widget_rendered ) {
			return '';
		}

		$this->widget_rendered = true;
		$src = trailingslashit( $options['app_url'] ) . 'embed.js';

		return sprintf(
			'<script async defer src="%1$s" data-agent-id="%2$s"></script>',
			esc_url( $src ),
			esc_attr( $agent_id )
		);
	}

	private function enqueue_takeover_css( $hide_footer, $hide_title ) {
		if ( $this->takeover_css_printed || ( ! $hide_footer && ! $hide_title ) ) {
			return;
		}

		$rules = array();

		if ( $hide_footer ) {
			$rules[] = 'body:has(.vonza-front-desk-page-takeover) footer,body:has(.vonza-front-desk-page-takeover) .site-footer,body:has(.vonza-front-desk-page-takeover) #colophon,body:has(.vonza-front-desk-page-takeover) .footer{display:none!important;}';
		}

		if ( $hide_title ) {
			$rules[] = 'body:has(.vonza-front-desk-page-takeover) .entry-title,body:has(.vonza-front-desk-page-takeover) .page-title,body:has(.vonza-front-desk-page-takeover) h1.wp-block-post-title{display:none!important;}';
		}

		if ( empty( $rules ) ) {
			return;
		}

		wp_register_style( 'vonza-front-desk-takeover', false, array(), VONZA_FRONT_DESK_VERSION );
		wp_enqueue_style( 'vonza-front-desk-takeover' );
		wp_add_inline_style( 'vonza-front-desk-takeover', implode( "\n", $rules ) );
		$this->takeover_css_printed = true;
	}

	private function build_html_attributes( $attrs ) {
		$html = '';

		foreach ( $attrs as $name => $value ) {
			$html .= '' === $value
				? ' ' . esc_attr( $name )
				: sprintf( ' %1$s="%2$s"', esc_attr( $name ), esc_attr( $value ) );
		}

		return $html;
	}
}
