<?php
/*
Plugin Name:LocoAI – Chrome AI Auto Translator
Description:Auto translation addon for Loco Translate – translate plugin & theme strings using AI tools like Chrome AI.
Version:1.0.0
License:GPLv3
Text Domain:loco-translate-addon
Domain Path:languages
Requires Plugins: loco-translate
Plugin URI: https://github.com/JYOTITHAKUROSEM/locoai-chrome-ai-auto-translator.git
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

define( 'LCAT_PRO_FILE', __FILE__ );
define( 'LCAT_PRO_URL', plugin_dir_url( LCAT_PRO_FILE ) );
define( 'LCAT_PRO_PATH', plugin_dir_path( LCAT_PRO_FILE ) );
define( 'LCAT_PRO_VERSION', '1.0.0' );


if ( ! class_exists( 'LocoAIChromeAutoTranslate' ) ) {

	/** Singleton ************************************/
	final class LocoAIChromeAutoTranslate {

		/**
		 * The unique instance of the plugin.
		 
		 * @var LocoAIChromeAutoTranslate
		 */

		private static $instance;

		/**
		 * Gets an instance of plugin.
		 */
		public static function get_instance() {

			if ( null === self::$instance ) {
				self::$instance = new self();

				self::$instance->register();

			}

			return self::$instance;
		}
		/**
		 * Constructor.
		 *
		 * Initializes the plugin instance. Currently does not perform any actions.
		 */
		public function __construct() {
		}
		
		/**
		 * Register plugin hooks and WordPress integrations.
		 *
		 * @return void
		 */
		public static function register() {

			$thisPlugin = self::$instance;
			register_activation_hook( LCAT_PRO_FILE, array( $thisPlugin, 'lcat_activate' ) );
			register_deactivation_hook( LCAT_PRO_FILE, array( $thisPlugin, 'lcat_deactivate' ) );

			if ( is_admin() ) {

				add_action( 'init', array( $thisPlugin, 'lcat_load_textdomain' ) );
				add_action( 'admin_enqueue_scripts', array( $thisPlugin, 'lcat_enqueue_scripts' ) );
				add_filter( 'loco_api_providers', array( $thisPlugin, 'lcat_register_api' ), 10, 1 );
				add_action( 'loco_api_ajax', array( $thisPlugin, 'lcat_ajax_init' ), 0, 0 );
				add_action( 'wp_ajax_save_all_translations', array( $thisPlugin, 'lcat_save_translations_handler' ) );
		
			}

		}

		/**
		 * Register Loco Translate API provider for the Auto Translate addon.
		 *
		 * @param array $apis Existing API providers.
		 * @return array Modified list of API providers including this addon.
		 */
		function lcat_register_api( array $apis ) {

			$apis[] = array(
				'id'   => 'loco_auto',
				'key'  => '122343',
				'url'  => 'https://locoaddon.com/',
				'name' => 'Automatic Translate Addon',
			);
			return $apis;
		}
		
		/**
		 * Initialize AJAX-related filters for Loco Translate.
		 *
		 * @return void
		 */
		function lcat_ajax_init() {
			
			add_filter( 'loco_api_translate_loco_auto', array( self::$instance, 'lcat_loco_auto_translator_process_batch' ), 0, 4 );
		}
		
		/**
		 * Provide translations for a batch of items using cached transient data.
		 *
		 * @param array       $targets Placeholder for translated targets.
		 * @param array       $items   Source items to translate.
		 * @param Loco_Locale $locale  Target locale.
		 * @param array       $config  Provider configuration.
		 * @return array Resolved targets mapped by index.
		 * @throws Loco_error_Exception When cached data is not available.
		 */
		function lcat_loco_auto_translator_process_batch(array $targets, array $items, Loco_Locale $locale, array $config) {
			
			$targets = array();

			// Extract and validate domain component safely
			$domain   = 'temp';
			$referer  = isset( $_SERVER['HTTP_REFERER'] ) ? sanitize_text_field( $_SERVER['HTTP_REFERER'] ) : '';
			if ( is_string( $referer ) && $referer !== '' ) {
				$referer_host = parse_url( $referer, PHP_URL_HOST );
				$site_host    = parse_url( admin_url(), PHP_URL_HOST );
				if ( $referer_host && $site_host && strtolower( $referer_host ) === strtolower( $site_host ) ) {
					$query = parse_url( $referer, PHP_URL_QUERY );
					if ( is_string( $query ) ) {
						$params = array();
						parse_str( $query, $params );
						if ( isset( $params['domain'] ) && is_string( $params['domain'] ) ) {
							$domain_candidate = sanitize_key( $params['domain'] );
							if ( $domain_candidate !== '' ) {
								$domain = $domain_candidate;
							}
						}
					}
				}
			}
			$lang       = sanitize_text_field( $locale->lang );
			$region     = sanitize_text_field( $locale->region );
			$project_id = $domain . '-' . $lang . '-' . $region;

			// Combine transient parts if available
			$allString = array();
			$translationData = array();
			for ( $i = 0; $i <= 4; $i++ ) {
				$transient_data = get_transient( $project_id . '-part-' . $i );

				if ( ! empty( $transient_data ) ) {
					if (isset( $transient_data['strings'] )) {
						$allString = array_merge( $allString, $transient_data['strings'] );
					}
				}
			}
			if (!empty($allString)) {
				foreach ($items as $i => $item) {
					$normalizedSource = preg_replace('/\s+/', ' ', trim($item['source']));
		
					// Find the index of the normalized source string in the cached strings
					$index = array_search($normalizedSource, array_column($allString, 'source'));
					if (is_numeric($index) && isset($allString[$index]['target'])) {
						$targets[$i] = $allString[$index]['target'];
					} else {
						$targets[$i] = '';
					}
				}

				return $targets;
			} else {
				throw new Loco_error_Exception( 'Please translate strings using the Auto Translate addon button first.' );
			}

		}

		/**
		 * AJAX handler to store translated strings into transients.
		 *
		 * Expects nonce, data (JSON), part, and project-id. Optionally accepts translation_data (JSON).
		 *
		 * @return void Outputs JSON success or error and terminates execution.
		 */
		function lcat_save_translations_handler() {

			check_ajax_referer( 'loco-addon-nonces', 'wpnonce' );

			// Add capability check
			if ( ! current_user_can( 'manage_options' ) ) {
				wp_send_json_error( array( 'error' => 'Insufficient permissions.' ) );
			}
		
			if ( ! isset( $_POST['data'], $_POST['part'], $_POST['project-id'] ) || empty( $_POST['data'] ) ) {
				wp_send_json_error( array( 'error' => 'Invalid request. Missing required parameters.' ) );
			}
		
			$raw_data        = wp_unslash( $_POST['data'] );
			$raw_translation = isset( $_POST['translation_data'] ) ? wp_unslash( $_POST['translation_data'] ) : null;
			$part            = sanitize_text_field( wp_unslash( $_POST['part'] ) );
			$project_id      = sanitize_text_field( wp_unslash( $_POST['project-id'] ) );
	
		
			$allStrings = json_decode( $raw_data, true );
			if ( json_last_error() !== JSON_ERROR_NONE || empty( $allStrings ) || ! is_array( $allStrings ) ) {
				wp_send_json_error(
					array(
						'success' => false,
						'error'   => 'No data found in the request. Unable to save translations.',
					)
				);
			}
		
			$translationData = null;
			if ( null !== $raw_translation && '' !== $raw_translation ) {
				$translationData = json_decode( $raw_translation, true );
				if ( json_last_error() !== JSON_ERROR_NONE ) {
					wp_send_json_error( array( 'error' => 'Invalid JSON in translation_data.' ) );
				}
			}
		
			$projectId   = $project_id . $part;
			$dataToStore = array(
				'strings' => $allStrings,
			);
		
			// Save metadata exactly when original did: only for -part-0
			if ( '-part-0' === $part && is_array( $translationData ) ) {
				$metadata = array(
					'translation_provider' => isset( $translationData['translation_provider'] ) ? sanitize_text_field( $translationData['translation_provider'] ) : '',
					'string_count'         => isset( $translationData['string_count'] ) ? absint( $translationData['string_count'] ) : 0,
					'character_count'      => isset( $translationData['character_count'] ) ? absint( $translationData['character_count'] ) : 0,
					'time_taken'           => isset( $translationData['time_taken'] ) ? absint( $translationData['time_taken'] ) : 0,
					'pluginORthemeName'    => isset( $translationData['pluginORthemeName'] ) ? sanitize_text_field( $translationData['pluginORthemeName'] ) : '',
					'target_language'      => isset( $translationData['target_language'] ) ? sanitize_text_field( $translationData['target_language'] ) : '',
				);
		
				
			}
		
			$rs = set_transient( $projectId, $dataToStore, 5 * MINUTE_IN_SECONDS );
			wp_send_json_success(
				array(
					'success'  => true,
					'message'  => 'Translations successfully stored in the cache.',
					'response' => ( true === $rs ? 'saved' : 'cache already exists' ),
				)
			);
		}

		
		/**
		 * Load plugin text domain for translations.
		 *
		 * @return void
		 */
		public function lcat_load_textdomain() {
			
			load_plugin_textdomain( 'loco-auto-translate', false, basename( dirname( LCAT_PRO_FILE ) ) . '/languages/' );
			
		}

		/**
		 * Enqueue admin scripts and styles on relevant Loco Translate screens.
		 *
		 * @param string $hook Current admin page hook suffix.
		 * @return void
		 */
		function lcat_enqueue_scripts( $hook ) {
			
			if ( $hook == 'loco-translate_page_loco-lcat-register' ) {
				return;
			}
			if (( isset( $_REQUEST['action'] ) && sanitize_key( wp_unslash( $_REQUEST['action'] ) ) === 'file-edit' ) ) {
			
				wp_register_script( 'loco-addon-custom', LCAT_PRO_URL . 'assets/js/lcat-pro-custom.min.js', array( 'loco-translate-admin' ), LCAT_PRO_VERSION, true );
				wp_register_script( 'lcat-chrome-ai-translator-for-loco', LCAT_PRO_URL . 'assets/js/lcat-chrome-ai-translator.min.js', array( 'loco-addon-custom' ), LCAT_PRO_VERSION, true );
				
				wp_register_style(
						'loco-addon-custom-css',
						LCAT_PRO_URL . 'assets/css/lcat-custom.min.css',
						null,
						LCAT_PRO_VERSION,
						'all'
				);
				wp_enqueue_script( 'loco-addon-custom' );
				wp_enqueue_script( 'lcat-chrome-ai-translator-for-loco' );
				wp_enqueue_style( 'loco-addon-custom-css' );

				$extraData['ajax_url']        = admin_url( 'admin-ajax.php' );
				$extraData['nonce']           = wp_create_nonce( 'loco-addon-nonces' );
				$extraData['LCAT_URL']        = LCAT_PRO_URL;
				$extraData['preloader_path']  = 'preloader.gif';
				$extraData['chromeAi_preview']      = 'chrome.png';
				$extraData['error_preview']    = 'error-icon.svg';
				$extraData['document_preview'] = 'document.svg';
				$extraData['extra_class']= is_rtl() ? 'lcat-rtl' : '';
				wp_localize_script( 'loco-addon-custom', 'extradata', $extraData );
				wp_add_inline_script(
						'loco-translate-admin',
						'var returnedTarget = JSON.parse(JSON.stringify(window.loco));window.locoConf=returnedTarget;'
					);	
			}
		}

		/**
		 * Run on plugin activation: set initial options and metadata.
		 *
		 * @return void
		 */
		public function lcat_activate() {
			
			update_option('lcat-pro-version', LCAT_PRO_VERSION);
			update_option('lcat-pro-installDate', gmdate('Y-m-d h:i:s'));
			update_option('lcat-type', 'PRO');
	
		}

		/**
		 * Run on plugin deactivation.
		 *
		 * @return void
		 */
		public function lcat_deactivate() {
		}

		/**
		 * Prevent cloning of the singleton instance.
		 *
		 * @return void
		 */
		public function __clone() {
			// Cloning instances of the class is forbidden.
			_doing_it_wrong( __FUNCTION__, __( 'Cheatin&#8217; huh?', 'loco-auto-translate' ), '2.3' );
		}

		/**
		 * Prevent unserialization of the singleton instance.
		 *
		 * @return void
		 */
		public function __wakeup() {
			// Unserializing instances of the class is forbidden.
			_doing_it_wrong( __FUNCTION__, __( 'Cheatin&#8217; huh?', 'loco-auto-translate' ), '2.3' );
		}

	}

	/**
	 * Helper function to get the singleton plugin instance.
	 *
	 * @return LocoAIChromeAutoTranslate
	 */
	function LCAT_PRO() {
		return LocoAIChromeAutoTranslate::get_instance();
	}

	LCAT_PRO();
}

