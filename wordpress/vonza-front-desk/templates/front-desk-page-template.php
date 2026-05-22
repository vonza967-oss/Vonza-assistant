<?php
/**
 * Dedicated Front Desk page template.
 *
 * @package VonzaFrontDesk
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$vonza_front_desk_plugin = Vonza_Front_Desk_Plugin::instance();
$vonza_front_desk_options = $vonza_front_desk_plugin->get_options();
$vonza_front_desk_agent_id = $vonza_front_desk_plugin->sanitize_agent_id( $vonza_front_desk_options['agent_id'] );
$vonza_front_desk_public_page_key = $vonza_front_desk_plugin->sanitize_public_page_key( $vonza_front_desk_options['public_page_key'] );
$vonza_front_desk_app_url = trailingslashit( $vonza_front_desk_options['app_url'] );
$vonza_front_desk_hide_footer = '1' === $vonza_front_desk_options['hide_page_footer'];
$vonza_front_desk_hide_title = '1' === $vonza_front_desk_options['hide_page_title'];

get_header();
?>

<style>
	body.vonza-front-desk-page .entry-content,
	body.vonza-front-desk-page .wp-block-post-content,
	body.vonza-front-desk-page .site-main,
	body.vonza-front-desk-page .content-area {
		max-width: none !important;
		width: 100% !important;
		padding: 0 !important;
		margin: 0 !important;
	}

	body.vonza-front-desk-page .vonza-front-desk-template-shell {
		display: block;
		width: 100%;
		min-height: calc(100vh - var(--wp-admin--admin-bar--height, 0px));
		padding: 0;
		margin: 0;
		background: transparent;
	}

	body.vonza-front-desk-page .vonza-front-desk-template-embed {
		width: 100%;
		min-height: inherit;
	}
</style>

<main id="vonza-front-desk-page" class="vonza-front-desk-template-shell" role="main">
	<?php if ( empty( $vonza_front_desk_agent_id ) ) : ?>
		<?php if ( current_user_can( 'manage_options' ) ) : ?>
			<p class="vonza-front-desk-notice"><?php echo esc_html__( 'Vonza Front Desk is missing an Agent ID.', 'vonza-front-desk' ); ?></p>
		<?php endif; ?>
	<?php else : ?>
		<div
			class="vonza-front-desk-template-embed"
			data-vonza-assistant
			data-agent-id="<?php echo esc_attr( $vonza_front_desk_agent_id ); ?>"
			<?php if ( ! empty( $vonza_front_desk_public_page_key ) ) : ?>
				data-public-page-key="<?php echo esc_attr( $vonza_front_desk_public_page_key ); ?>"
			<?php endif; ?>
			data-layout="page-takeover"
			data-surface="flat"
			data-background-scope="page"
			data-page-reset="true"
			data-hide-page-footer="<?php echo esc_attr( $vonza_front_desk_hide_footer ? 'true' : 'false' ); ?>"
			data-hide-page-title="<?php echo esc_attr( $vonza_front_desk_hide_title ? 'true' : 'false' ); ?>"
		></div>
		<script async src="<?php echo esc_url( $vonza_front_desk_app_url . 'assistant-embed.js' ); ?>"></script>
	<?php endif; ?>
</main>

<?php
if ( ! $vonza_front_desk_hide_footer ) {
	get_footer();
}
