<?php
/**
 * WordPress admin settings screen.
 *
 * @package VonzaFrontDesk
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vonza_Front_Desk_Admin {
	const MENU_SLUG = 'vonza-front-desk';

	/**
	 * Plugin helper.
	 *
	 * @var Vonza_Front_Desk_Plugin
	 */
	private $plugin;

	public function __construct( Vonza_Front_Desk_Plugin $plugin ) {
		$this->plugin = $plugin;
	}

	public function init() {
		add_action( 'admin_menu', array( $this, 'add_menu_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'admin_post_vonza_front_desk_save', array( $this, 'handle_save_settings' ) );
		add_action( 'admin_post_vonza_front_desk_create_page', array( $this, 'handle_create_page' ) );
	}

	public function add_menu_page() {
		add_menu_page(
			__( 'Vonza Front Desk', 'vonza-front-desk' ),
			__( 'Vonza Front Desk', 'vonza-front-desk' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_settings_page' ),
			'dashicons-format-chat',
			58
		);
	}

	public function enqueue_admin_assets( $hook ) {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}

		wp_enqueue_style(
			'vonza-front-desk-admin',
			VONZA_FRONT_DESK_URL . 'assets/admin.css',
			array(),
			VONZA_FRONT_DESK_VERSION
		);

		wp_enqueue_script(
			'vonza-front-desk-admin',
			VONZA_FRONT_DESK_URL . 'assets/admin.js',
			array(),
			VONZA_FRONT_DESK_VERSION,
			true
		);
	}

	public function handle_save_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Vonza Front Desk settings.', 'vonza-front-desk' ) );
		}

		check_admin_referer( 'vonza_front_desk_save_settings' );

		$input = isset( $_POST['vonza_front_desk'] ) && is_array( $_POST['vonza_front_desk'] )
			? wp_unslash( $_POST['vonza_front_desk'] )
			: array();

		$status = 'settings-saved';
		if ( isset( $input['front_desk_page_id'] ) && '__create_new__' === $input['front_desk_page_id'] ) {
			$result = $this->create_or_adopt_front_desk_page( $input );

			if ( is_wp_error( $result ) ) {
				$this->redirect_with_status( 'page-error' );
			}

			$input['front_desk_page_id'] = absint( $result['page_id'] );
			$input['created_page_id'] = absint( $result['page_id'] );
			$status = $result['status'];
		}

		$this->plugin->save_options( $input );
		$this->redirect_with_status( $status );
	}

	public function handle_create_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to create Front Desk pages.', 'vonza-front-desk' ) );
		}

		check_admin_referer( 'vonza_front_desk_create_page' );

		$options = $this->plugin->get_options();
		$result  = $this->create_or_adopt_front_desk_page( $options );

		if ( is_wp_error( $result ) ) {
			$this->redirect_with_status( 'page-error' );
		}

		$options['front_desk_page_id'] = absint( $result['page_id'] );
		$options['created_page_id'] = absint( $result['page_id'] );
		$this->plugin->save_options( $options );
		$this->redirect_with_status( $result['status'] );
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$options = $this->plugin->get_options();
		$page    = $this->plugin->get_front_desk_page();
		$pages   = $this->get_selectable_pages();
		$status  = isset( $_GET['vonza_status'] ) ? sanitize_key( wp_unslash( $_GET['vonza_status'] ) ) : '';

		?>
		<div class="wrap vonza-front-desk-admin">
			<h1><?php echo esc_html__( 'Vonza Front Desk', 'vonza-front-desk' ); ?></h1>
			<?php $this->render_notice( $status ); ?>

			<div class="vonza-front-desk-grid">
				<section class="vonza-front-desk-card">
					<h2><?php echo esc_html__( 'Settings', 'vonza-front-desk' ); ?></h2>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="vonza_front_desk_save">
						<?php wp_nonce_field( 'vonza_front_desk_save_settings' ); ?>

						<label for="vonza-agent-id"><?php echo esc_html__( 'Agent ID', 'vonza-front-desk' ); ?></label>
						<input id="vonza-agent-id" class="regular-text" type="text" name="vonza_front_desk[agent_id]" value="<?php echo esc_attr( $options['agent_id'] ); ?>" autocomplete="off">

						<label for="vonza-app-url"><?php echo esc_html__( 'Vonza app URL', 'vonza-front-desk' ); ?></label>
						<input id="vonza-app-url" class="regular-text" type="url" name="vonza_front_desk[app_url]" value="<?php echo esc_url( $options['app_url'] ); ?>">

						<label>
							<input type="checkbox" name="vonza_front_desk[enable_widget]" value="1" <?php checked( '1', $options['enable_widget'] ); ?>>
							<?php echo esc_html__( 'Enable floating widget site-wide', 'vonza-front-desk' ); ?>
						</label>

						<label for="vonza-default-page-mode"><?php echo esc_html__( 'Default Front Desk page mode', 'vonza-front-desk' ); ?></label>
						<select id="vonza-default-page-mode" name="vonza_front_desk[default_page_mode]">
							<option value="section" <?php selected( 'section', $options['default_page_mode'] ); ?>><?php echo esc_html__( 'Section embed', 'vonza-front-desk' ); ?></option>
							<option value="page-takeover" <?php selected( 'page-takeover', $options['default_page_mode'] ); ?>><?php echo esc_html__( 'Dedicated page', 'vonza-front-desk' ); ?></option>
						</select>

						<label for="vonza-surface"><?php echo esc_html__( 'Surface', 'vonza-front-desk' ); ?></label>
						<select id="vonza-surface" name="vonza_front_desk[surface]">
							<option value="flat" <?php selected( 'flat', $options['surface'] ); ?>><?php echo esc_html__( 'flat', 'vonza-front-desk' ); ?></option>
							<option value="card" <?php selected( 'card', $options['surface'] ); ?>><?php echo esc_html__( 'card', 'vonza-front-desk' ); ?></option>
						</select>

						<label for="vonza-background-coverage"><?php echo esc_html__( 'Background coverage', 'vonza-front-desk' ); ?></label>
						<select id="vonza-background-coverage" name="vonza_front_desk[background_coverage]">
							<option value="section" <?php selected( 'section', $options['background_coverage'] ); ?>><?php echo esc_html__( 'section', 'vonza-front-desk' ); ?></option>
							<option value="page" <?php selected( 'page', $options['background_coverage'] ); ?>><?php echo esc_html__( 'page', 'vonza-front-desk' ); ?></option>
						</select>

						<h3><?php echo esc_html__( 'Front Desk page display', 'vonza-front-desk' ); ?></h3>
						<p><?php echo esc_html__( 'Template page is recommended. It removes theme content boxes and lets Front Desk fill the page body.', 'vonza-front-desk' ); ?></p>

						<label for="vonza-front-desk-page-mode"><?php echo esc_html__( 'Page mode', 'vonza-front-desk' ); ?></label>
						<select id="vonza-front-desk-page-mode" name="vonza_front_desk[front_desk_page_mode]">
							<option value="template" <?php selected( 'template', $options['front_desk_page_mode'] ); ?>><?php echo esc_html__( 'Template page', 'vonza-front-desk' ); ?></option>
							<option value="shortcode" <?php selected( 'shortcode', $options['front_desk_page_mode'] ); ?>><?php echo esc_html__( 'Shortcode fallback', 'vonza-front-desk' ); ?></option>
						</select>
						<p><?php echo esc_html__( 'Template page mode is recommended. It lets Vonza render Front Desk without your theme\'s content box.', 'vonza-front-desk' ); ?></p>

						<label for="vonza-front-desk-page-id"><?php echo esc_html__( 'Front Desk page', 'vonza-front-desk' ); ?></label>
						<select id="vonza-front-desk-page-id" name="vonza_front_desk[front_desk_page_id]">
							<option value="0" <?php selected( 0, absint( $options['front_desk_page_id'] ) ); ?>><?php echo esc_html__( 'None selected', 'vonza-front-desk' ); ?></option>
							<option value="__create_new__"><?php echo esc_html__( 'Create new page', 'vonza-front-desk' ); ?></option>
							<?php foreach ( $pages as $selectable_page ) : ?>
								<option value="<?php echo esc_attr( $selectable_page->ID ); ?>" <?php selected( absint( $selectable_page->ID ), absint( $options['front_desk_page_id'] ) ); ?>>
									<?php
									echo esc_html(
										sprintf(
											/* translators: 1: page title, 2: page status. */
											__( '%1$s (%2$s)', 'vonza-front-desk' ),
											get_the_title( $selectable_page ),
											$selectable_page->post_status
										)
									);
									?>
								</option>
							<?php endforeach; ?>
						</select>
						<p><?php echo esc_html__( 'Use an existing page if you already created an AI Assistant or support page.', 'vonza-front-desk' ); ?></p>

						<label for="vonza-front-desk-page-title"><?php echo esc_html__( 'Page title', 'vonza-front-desk' ); ?></label>
						<input id="vonza-front-desk-page-title" class="regular-text" type="text" name="vonza_front_desk[front_desk_page_title]" value="<?php echo esc_attr( $options['front_desk_page_title'] ); ?>">

						<label for="vonza-front-desk-page-slug"><?php echo esc_html__( 'Page slug', 'vonza-front-desk' ); ?></label>
						<input id="vonza-front-desk-page-slug" class="regular-text" type="text" name="vonza_front_desk[front_desk_page_slug]" value="<?php echo esc_attr( $options['front_desk_page_slug'] ); ?>">

						<?php if ( $page ) : ?>
							<p class="vonza-front-desk-page-links">
								<a class="button" href="<?php echo esc_url( get_permalink( $page ) ); ?>" target="_blank" rel="noreferrer"><?php echo esc_html__( 'View page', 'vonza-front-desk' ); ?></a>
								<a class="button" href="<?php echo esc_url( get_edit_post_link( $page->ID, '' ) ); ?>"><?php echo esc_html__( 'Edit page', 'vonza-front-desk' ); ?></a>
							</p>
						<?php endif; ?>

						<label>
							<input type="checkbox" name="vonza_front_desk[hide_page_footer]" value="1" <?php checked( '1', $options['hide_page_footer'] ); ?>>
							<?php echo esc_html__( 'Hide page footer for dedicated page', 'vonza-front-desk' ); ?>
						</label>

						<label>
							<input type="checkbox" name="vonza_front_desk[hide_page_title]" value="1" <?php checked( '1', $options['hide_page_title'] ); ?>>
							<?php echo esc_html__( 'Hide page title for dedicated page', 'vonza-front-desk' ); ?>
						</label>

						<p><?php echo esc_html__( 'Website header is kept on the Front Desk page.', 'vonza-front-desk' ); ?></p>

						<?php submit_button( __( 'Save settings', 'vonza-front-desk' ) ); ?>
					</form>
				</section>

				<section class="vonza-front-desk-card">
					<h2><?php echo esc_html__( 'Front Desk page', 'vonza-front-desk' ); ?></h2>
					<p><?php echo esc_html__( 'For WordPress, use the Vonza plugin to create a dedicated Front Desk page. This avoids manual snippets and theme content boxes.', 'vonza-front-desk' ); ?></p>
					<p><strong><?php echo esc_html__( 'Selected Front Desk page:', 'vonza-front-desk' ); ?></strong> <?php echo esc_html( $page ? get_the_title( $page ) : __( 'None selected', 'vonza-front-desk' ) ); ?></p>
					<p><strong><?php echo esc_html__( 'Page mode:', 'vonza-front-desk' ); ?></strong> <?php echo esc_html( 'template' === $options['front_desk_page_mode'] ? __( 'Template page', 'vonza-front-desk' ) : __( 'Shortcode fallback', 'vonza-front-desk' ) ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="vonza_front_desk_create_page">
						<?php wp_nonce_field( 'vonza_front_desk_create_page' ); ?>
						<?php submit_button( __( 'Create Front Desk page', 'vonza-front-desk' ), 'primary', 'submit', false ); ?>
					</form>

					<?php if ( $page ) : ?>
						<p class="vonza-front-desk-page-links">
							<a class="button" href="<?php echo esc_url( get_permalink( $page ) ); ?>" target="_blank" rel="noreferrer"><?php echo esc_html__( 'View page', 'vonza-front-desk' ); ?></a>
							<a class="button" href="<?php echo esc_url( get_edit_post_link( $page->ID, '' ) ); ?>"><?php echo esc_html__( 'Edit page', 'vonza-front-desk' ); ?></a>
						</p>
					<?php endif; ?>
				</section>

				<section class="vonza-front-desk-card">
					<h2><?php echo esc_html__( 'Snippets', 'vonza-front-desk' ); ?></h2>
					<p><strong><?php echo esc_html__( 'Current Agent ID:', 'vonza-front-desk' ); ?></strong> <?php echo esc_html( $options['agent_id'] ?: __( 'Not set', 'vonza-front-desk' ) ); ?></p>
					<p><?php echo esc_html__( 'Use the Front Desk shortcode for page content. The floating widget shortcode is optional for a compact website bubble.', 'vonza-front-desk' ); ?></p>
					<code>[vonza_front_desk layout="page-takeover"]</code>
					<code>[vonza_front_desk layout="section"]</code>
					<code>[vonza_widget]</code>
					<p><a href="<?php echo esc_url( trailingslashit( $options['app_url'] ) . 'dashboard#install' ); ?>" target="_blank" rel="noreferrer"><?php echo esc_html__( 'Open Vonza dashboard', 'vonza-front-desk' ); ?></a></p>
				</section>
			</div>
		</div>
		<?php
	}

	private function render_notice( $status ) {
		$messages = array(
			'settings-saved' => __( 'Vonza Front Desk settings saved.', 'vonza-front-desk' ),
			'page-created'   => __( 'Front Desk page created.', 'vonza-front-desk' ),
			'page-exists'    => __( 'Front Desk page already exists.', 'vonza-front-desk' ),
			'page-error'     => __( 'Could not create the Front Desk page.', 'vonza-front-desk' ),
		);

		if ( empty( $messages[ $status ] ) ) {
			return;
		}

		$class = 'page-error' === $status ? 'notice notice-error' : 'notice notice-success';
		printf( '<div class="%1$s"><p>%2$s</p></div>', esc_attr( $class ), esc_html( $messages[ $status ] ) );
	}

	private function create_or_adopt_front_desk_page( $options ) {
		$current_page = $this->plugin->get_front_desk_page();
		if ( $current_page ) {
			update_post_meta( $current_page->ID, Vonza_Front_Desk_Plugin::FRONT_DESK_PAGE_META, '1' );
			return array(
				'page_id' => absint( $current_page->ID ),
				'status'  => 'page-exists',
			);
		}

		$options = $this->plugin->sanitize_options( $options );
		$existing_page = get_page_by_path( $options['front_desk_page_slug'], OBJECT, 'page' );
		if ( $existing_page && in_array( $existing_page->post_status, array( 'publish', 'draft' ), true ) ) {
			update_post_meta( $existing_page->ID, Vonza_Front_Desk_Plugin::FRONT_DESK_PAGE_META, '1' );
			return array(
				'page_id' => absint( $existing_page->ID ),
				'status'  => 'page-exists',
			);
		}

		$page_id = wp_insert_post(
			array(
				'post_title'   => $options['front_desk_page_title'],
				'post_name'    => $options['front_desk_page_slug'],
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_content' => '[vonza_front_desk layout="page-takeover"]',
			),
			true
		);

		if ( is_wp_error( $page_id ) ) {
			return $page_id;
		}

		update_post_meta( $page_id, Vonza_Front_Desk_Plugin::FRONT_DESK_PAGE_META, '1' );
		return array(
			'page_id' => absint( $page_id ),
			'status'  => 'page-created',
		);
	}

	private function get_selectable_pages() {
		return get_pages(
			array(
				'post_status' => array( 'publish', 'draft' ),
				'sort_column' => 'post_title',
				'sort_order'  => 'ASC',
			)
		);
	}

	private function redirect_with_status( $status ) {
		wp_safe_redirect(
			add_query_arg(
				array(
					'page'         => self::MENU_SLUG,
					'vonza_status' => sanitize_key( $status ),
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}
}
