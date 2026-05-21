import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pluginRoot = path.join(repoRoot, "wordpress", "vonza-front-desk");

function readPluginFile(relativePath) {
  return readFileSync(path.join(pluginRoot, relativePath), "utf8");
}

test("Vonza Front Desk WordPress plugin exposes required header and files", () => {
  const main = readPluginFile("vonza-front-desk.php");

  assert.match(main, /Plugin Name:\s*Vonza Front Desk/);
  assert.match(main, /Description:\s*Add the Vonza AI Front Desk to your WordPress website\./);
  assert.match(main, /Version:\s*0\.1\.0/);
  assert.match(main, /Author:\s*Vonza/);
  assert.match(main, /Text Domain:\s*vonza-front-desk/);
  assert.match(main, /class-vonza-front-desk-plugin\.php/);
  assert.match(main, /class-vonza-front-desk-admin\.php/);
  assert.match(main, /class-vonza-front-desk-renderer\.php/);
});

test("Vonza Front Desk WordPress plugin registers admin settings and shortcodes safely", () => {
  const admin = readPluginFile("includes/class-vonza-front-desk-admin.php");
  const renderer = readPluginFile("includes/class-vonza-front-desk-renderer.php");
  const plugin = readPluginFile("includes/class-vonza-front-desk-plugin.php");

  assert.match(admin, /add_menu_page\(/);
  assert.match(admin, /manage_options/);
  assert.match(admin, /check_admin_referer\(\s*'vonza_front_desk_save_settings'/);
  assert.match(admin, /check_admin_referer\(\s*'vonza_front_desk_create_page'/);
  assert.match(admin, /wp_insert_post\(/);
  assert.match(admin, /\[vonza_front_desk layout="page-takeover"\]/);
  assert.match(admin, /esc_html/);
  assert.match(admin, /esc_attr/);
  assert.match(admin, /esc_url/);

  assert.match(renderer, /add_shortcode\(\s*'vonza_front_desk'/);
  assert.match(renderer, /add_shortcode\(\s*'vonza_widget'/);
  assert.match(renderer, /assistant-embed\.js/);
  assert.match(renderer, /embed\.js/);
  assert.match(renderer, /data-page-reset/);
  assert.match(renderer, /vonza-front-desk-page-takeover/);
  assert.match(renderer, /wp_enqueue_script/);
  assert.match(renderer, /wp_add_inline_style/);
  assert.match(renderer, /esc_attr/);
  assert.match(renderer, /esc_url/);

  assert.match(plugin, /Options API|update_option|get_option|OPTION_NAME/s);
  assert.match(plugin, /https:\/\/vonza-assistant\.onrender\.com/);
  assert.match(plugin, /sanitize_text_field/);
  assert.match(plugin, /wp_http_validate_url/);
});

test("Vonza Front Desk WordPress plugin has no hardcoded customer Agent ID or secrets", () => {
  const combined = [
    readPluginFile("vonza-front-desk.php"),
    readPluginFile("includes/class-vonza-front-desk-plugin.php"),
    readPluginFile("includes/class-vonza-front-desk-admin.php"),
    readPluginFile("includes/class-vonza-front-desk-renderer.php"),
    readPluginFile("readme.txt"),
  ].join("\n");

  assert.doesNotMatch(combined, /SERVICE_ROLE|SUPABASE_SERVICE|\bsk-(?:proj-)?[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(combined, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(combined, /vonzastudio\.com/i);
});
