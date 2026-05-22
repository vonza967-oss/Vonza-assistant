=== Vonza Front Desk ===
Contributors: vonza
Tags: ai, chat, front desk, assistant
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later

Add the Vonza AI Front Desk to your WordPress website.

== Description ==

Vonza Front Desk lets a business owner or agency create a dedicated AI Front Desk page on WordPress without manually editing smart embed snippets. Configure an Agent ID, select an existing Front Desk page, create a dedicated Front Desk page, or optionally enable the floating widget site-wide.

The created Front Desk page uses a plugin template by default, so it can render below the website header without the theme's normal page content box. This avoids manual snippets and theme content boxes. Shortcodes remain available for regular page sections, manual placement, and the optional website bubble.

== Installation ==

1. Upload the `vonza-front-desk` folder as a WordPress plugin.
2. Activate "Vonza Front Desk".
3. Go to WP Admin -> Vonza Front Desk.
4. Enter your Agent ID and save.
5. Select an existing Front Desk or support page, or click "Create Front Desk page".
6. Use Template page mode unless your theme requires the shortcode fallback.

== Shortcodes ==

`[vonza_front_desk]`

Supported attributes:

* `layout`: `section`, `full-page`, or `page-takeover`
* `surface`: `flat` or `card`
* `background_scope`: `section`, `page`, or `iframe`
* `hide_footer`: `true` or `false`
* `hide_title`: `true` or `false`
* `agent_id`: optional Agent ID override

Examples:

`[vonza_front_desk layout="page-takeover"]`
`[vonza_front_desk layout="section"]`
`[vonza_widget]`

== Gutenberg Block ==

A Gutenberg block is deferred for this private V1. Use the shortcodes above in the block editor.

== Changelog ==

= 0.1.0 =
* Initial private V1 plugin.
