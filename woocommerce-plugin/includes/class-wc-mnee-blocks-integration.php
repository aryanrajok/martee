<?php
/**
 * MNEE Stablecoin Blocks Integration
 * 
 * @package WooCommerce_MNEE_Gateway
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * MNEE payment method integration for WooCommerce Blocks
 */
final class WC_MNEE_Blocks_Integration extends \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {

    /**
     * The gateway instance.
     */
    private $gateway;

    /**
     * Payment method name/id/slug.
     */
    protected $name = 'mnee_gateway';

    /**
     * Initializes the payment method type.
     */
    public function initialize() {
        $this->settings = get_option('woocommerce_mnee_gateway_settings', []);
        $gateways       = WC()->payment_gateways->payment_gateways();
        $this->gateway  = $gateways[$this->name];
    }

    /**
     * Returns if this payment method should be active. If false, the scripts will not be enqueued.
     */
    public function is_active() {
        return $this->gateway->is_available();
    }

    /**
     * Returns an array of scripts/handles to be registered for this payment method.
     */
    public function get_payment_method_script_handles() {
        $script_path       = '/assets/js/frontend/blocks.js';
        $script_asset_path = WC_MNEE_GATEWAY_PLUGIN_PATH . 'assets/js/frontend/blocks.asset.php';
        $script_asset      = file_exists($script_asset_path)
            ? require($script_asset_path)
            : array(
                'dependencies' => array(),
                'version'      => WC_MNEE_GATEWAY_VERSION,
            );
        $script_url        = WC_MNEE_GATEWAY_PLUGIN_URL . $script_path;

        wp_register_script(
            'wc-MNEE-payments-blocks',
            $script_url,
            $script_asset['dependencies'],
            $script_asset['version'],
            true
        );

        if (function_exists('wp_set_script_translations')) {
            wp_set_script_translations('wc-MNEE-payments-blocks', 'wc-MNEE-gateway', WC_MNEE_GATEWAY_PLUGIN_PATH . 'languages/');
        }

        return ['wc-MNEE-payments-blocks'];
    }

    /**
     * Returns an array of key=>value pairs of data made available to the payment methods script.
     */
    public function get_payment_method_data() {
        return [
            'title'        => $this->get_setting('title'),
            'description'  => $this->get_setting('description'),
            'supports'     => array_filter($this->gateway->supports, [$this->gateway, 'supports']),
            'logo_url'     => '', // Add logo URL if you have one
            'testmode'     => $this->get_setting('testmode') === 'yes',
        ];
    }
}