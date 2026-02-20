<?php
/**
 * Plugin Name: Cartee – Crypto Payment Gateway
 * Plugin URI:  https://cartee-dashboard.vercel.app
 * Description: Accept BNB token payments on your WooCommerce store via Cartee. Customers click "Pay with Cartee", connect their wallet and pay on-chain — orders are confirmed automatically.
 * Version:     2.0.0
 * Author:      Cartee
 * Author URI:  https://cartee-dashboard.vercel.app
 * Text Domain: cartee-gateway
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.9
 *
 * @package Cartee_Payment_Gateway
 */

if (!defined('ABSPATH')) {
    exit;
}

// ------------------------------------------------------------------
// Guard: WooCommerce must be active
// ------------------------------------------------------------------
add_action('plugins_loaded', 'cartee_gateway_init', 11);

function cartee_gateway_init()
{
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    // ------------------------------------------------------------------
    // Main Gateway Class
    // ------------------------------------------------------------------
    class WC_Gateway_Cartee extends WC_Payment_Gateway
    {

        /** @var string */
        private $api_key;

        /** @var string */
        private $cartee_url;

        public function __construct()
        {
            $this->id = 'cartee_gateway';
            $this->has_fields = true;
            $this->method_title = __('Pay with Cartee', 'cartee-gateway');
            $this->method_description = __('Accept BNB token crypto payments on your store via Cartee. No middleman — payments go directly on-chain.', 'cartee-gateway');
            $this->supports = array('products');

            // Load settings
            $this->init_form_fields();
            $this->init_settings();

            $this->title = $this->get_option('title', __('Pay with Cartee', 'cartee-gateway'));
            $this->description = $this->get_option('description', __('Secure crypto payment via BNB Smart Chain.', 'cartee-gateway'));
            $this->enabled = $this->get_option('enabled', 'yes');
            $this->api_key = $this->get_option('api_key', '');
            $this->cartee_url = rtrim($this->get_option('cartee_url', 'https://cartee-dashboard.vercel.app'), '/');

            // Hooks
            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

            // AJAX: verify API key connection
            add_action('wp_ajax_cartee_verify_connection', array($this, 'ajax_verify_connection'));
            add_action('wp_ajax_nopriv_cartee_verify_connection', array($this, 'ajax_verify_connection'));

            // AJAX: confirm payment (called by blockchain listener via Cartee backend)
            add_action('wp_ajax_cartee_payment_confirm', array($this, 'ajax_payment_confirm'));
            add_action('wp_ajax_nopriv_cartee_payment_confirm', array($this, 'ajax_payment_confirm'));
        }

        // ==============================================================
        // Admin Settings
        // ==============================================================
        public function init_form_fields()
        {
            $this->form_fields = array(
                'enabled' => array(
                    'title' => __('Enable / Disable', 'cartee-gateway'),
                    'type' => 'checkbox',
                    'label' => __('Enable Cartee Crypto Payment', 'cartee-gateway'),
                    'default' => 'yes',
                ),
                'title' => array(
                    'title' => __('Title', 'cartee-gateway'),
                    'type' => 'text',
                    'description' => __('Label shown to the customer at checkout.', 'cartee-gateway'),
                    'default' => __('Pay with Cartee', 'cartee-gateway'),
                    'desc_tip' => true,
                ),
                'description' => array(
                    'title' => __('Description', 'cartee-gateway'),
                    'type' => 'textarea',
                    'description' => __('Short description shown below the payment title.', 'cartee-gateway'),
                    'default' => __('Pay securely using BNB tokens via Cartee — fast, non-custodial, on-chain.', 'cartee-gateway'),
                    'desc_tip' => true,
                ),
                'api_key' => array(
                    'title' => __('Cartee API Key', 'cartee-gateway'),
                    'type' => 'password',
                    'description' => sprintf(
                        /* translators: %s: link to Cartee dashboard */
                        __('Get your API key from the %s → Dashboard tab.', 'cartee-gateway'),
                        '<a href="https://cartee-dashboard.vercel.app" target="_blank">Cartee Dashboard</a>'
                    ),
                    'default' => '',
                    'placeholder' => 'ck_xxxxxxxxxxxxxxxxxxxxxxxx',
                ),
                'cartee_url' => array(
                    'title' => __('Cartee Server URL', 'cartee-gateway'),
                    'type' => 'text',
                    'description' => __('Leave default for production. Change to http://localhost:3000 for local development.', 'cartee-gateway'),
                    'default' => 'https://cartee-dashboard.vercel.app',
                    'placeholder' => 'https://cartee-dashboard.vercel.app',
                ),
            );
        }

        // ==============================================================
        // Admin Panel — add a "Test Connection" button below form
        // ==============================================================
        public function admin_options()
        {
            ?>
            <div style="display:flex;align-items:center;gap:12px;margin:16px 0 4px;">
                <img src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/cartee-logo.png'); ?>"
                    onerror="this.style.display='none'" alt="Cartee" style="height:32px;">
                <h2 style="margin:0;">
                    <?php esc_html_e('Cartee – Crypto Payment Gateway', 'cartee-gateway'); ?>
                </h2>
            </div>
            <p style="color:#666;">
                <?php esc_html_e('Accept BNB token payments directly on your store. Payments go wallet-to-wallet on-chain — no middleman.', 'cartee-gateway'); ?>
            </p>

            <table class="form-table">
                <?php $this->generate_settings_html(); ?>
            </table>

            <div
                style="margin:20px 0 10px;padding:16px 20px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;max-width:600px;">
                <strong>
                    <?php esc_html_e('Test Connection', 'cartee-gateway'); ?>
                </strong><br>
                <p style="margin:8px 0;font-size:13px;color:#555;">
                    <?php esc_html_e('Save your API key above, then click the button to verify it connects to Cartee.', 'cartee-gateway'); ?>
                </p>
                <button type="button" id="cartee-test-btn" class="button button-secondary">
                    <?php esc_html_e('Verify Connection', 'cartee-gateway'); ?>
                </button>
                <span id="cartee-test-result" style="margin-left:12px;font-size:13px;"></span>
            </div>

            <script>
                jQuery(function ($) {
                    $('#cartee-test-btn').on('click', function () {
                        var btn = $(this);
                        var result = $('#cartee-test-result');
                        btn.prop('disabled', true);
                        result.html('<span style="color:#888;">Checking…</span>');

                        $.post('<?php echo esc_js(admin_url('admin-ajax.php')); ?>', {
                            action: 'cartee_verify_connection',
                            nonce: '<?php echo esc_js(wp_create_nonce('cartee_admin')); ?>'
                                }, function (res) {
                            btn.prop('disabled', false);
                            if (res.success) {
                                result.html('<span style="color:green;">&#10003; ' + res.data.message + '</span>');
                            } else {
                                result.html('<span style="color:red;">&#10007; ' + res.data.message + '</span>');
                            }
                        }).fail(function () {
                            btn.prop('disabled', false);
                            result.html('<span style="color:red;">&#10007; Connection error</span>');
                        });
                    });
                });
            </script>
            <?php
        }

        // ==============================================================
        // Checkout: render the "Pay with Cartee" panel
        // ==============================================================
        public function payment_fields()
        {
            ?>
            <div id="cartee-checkout-panel" style="margin-top:8px;">
                <div style="
                    display:flex;align-items:center;gap:10px;
                    background:linear-gradient(135deg,#0d0d2b,#1a1a3e);
                    border:1px solid rgba(99,102,241,.4);
                    border-radius:12px;padding:18px 20px;
                ">
                    <!-- Cartee icon -->
                    <div style="
                        width:42px;height:42px;border-radius:50%;flex-shrink:0;
                        background:linear-gradient(135deg,#6366f1,#8b5cf6);
                        display:flex;align-items:center;justify-content:center;
                        font-size:20px;
                    ">⚡</div>

                    <div style="flex:1;">
                        <div style="font-weight:700;color:#fff;font-size:15px;margin-bottom:2px;">
                            <?php esc_html_e('Pay with Cartee', 'cartee-gateway'); ?>
                        </div>
                        <div style="color:rgba(255,255,255,.6);font-size:13px;">
                            <?php esc_html_e('Connect your wallet and pay with BNB tokens — fast & non-custodial.', 'cartee-gateway'); ?>
                        </div>
                    </div>

                    <!-- BNB badge -->
                    <div style="
                        background:rgba(240,185,11,.15);border:1px solid rgba(240,185,11,.4);
                        color:#f0b90b;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;
                        white-space:nowrap;
                    ">BNB Chain</div>
                </div>

                <p style="margin:10px 0 0;font-size:12px;color:#888;display:flex;align-items:center;gap:6px;">
                    <span>🔒</span>
                    <?php esc_html_e('You will be redirected to complete payment with your Web3 wallet. No account required.', 'cartee-gateway'); ?>
                </p>
            </div>
            <?php
        }

        public function validate_fields()
        {
            return true; // Validation happens on the Cartee pay page
        }

        // ==============================================================
        // Process Payment — create invoice, redirect to /pay
        // ==============================================================
        public function process_payment($order_id)
        {
            $order = wc_get_order($order_id);

            // Build webhook payload
            $payload = array(
                'order_id' => (string) $order_id,
                'order_key' => $order->get_order_key(),
                'store_name' => get_bloginfo('name'),
                'email' => $order->get_billing_email(),
                'total' => (float) $order->get_total(),
                'currency_code' => $order->get_currency(),
                'product_name' => $this->get_product_names($order),
                'api_key' => $this->api_key,
                'callback_url' => add_query_arg(
                    array('action' => 'cartee_payment_confirm'),
                    admin_url('admin-ajax.php')
                ),
            );

            $response = wp_remote_post(
                $this->cartee_url . '/api/webhooks/woocommerce',
                array(
                    'method' => 'POST',
                    'headers' => array('Content-Type' => 'application/json'),
                    'body' => wp_json_encode($payload),
                    'timeout' => 30,
                )
            );

            if (is_wp_error($response)) {
                wc_add_notice(
                    __('Cartee: Could not reach payment server — ', 'cartee-gateway') . $response->get_error_message(),
                    'error'
                );
                return array('result' => 'failure');
            }

            $code = wp_remote_retrieve_response_code($response);

            if ($code < 200 || $code >= 300) {
                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);
                $msg = isset($data['error']) ? $data['error'] : 'HTTP ' . $code;
                wc_add_notice(
                    __('Cartee payment error: ', 'cartee-gateway') . esc_html($msg),
                    'error'
                );
                return array('result' => 'failure');
            }

            // Hold the order while customer pays
            $order->update_status(
                'on-hold',
                __('Cartee invoice created. Awaiting on-chain payment.', 'cartee-gateway')
            );

            // Redirect to Cartee pay page
            $pay_url = $this->cartee_url . '/pay?orderId=' . urlencode($order->get_order_key());

            return array(
                'result' => 'success',
                'redirect' => $pay_url,
            );
        }

        // ==============================================================
        // Enqueue checkout CSS / JS
        // ==============================================================
        public function enqueue_scripts()
        {
            if (!is_checkout()) {
                return;
            }
            wp_add_inline_style('woocommerce-general', '
                li#payment_method_cartee_gateway label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                }
                .wc_payment_method.payment_method_cartee_gateway {
                    border: 2px solid transparent;
                    border-radius: 10px;
                    transition: border-color .2s;
                }
                .wc_payment_method.payment_method_cartee_gateway.selected,
                .wc_payment_method.payment_method_cartee_gateway:has(input:checked) {
                    border-color: #6366f1;
                    background: rgba(99,102,241,.04);
                }
            ');
        }

        // ==============================================================
        // AJAX: verify connection (admin panel)
        // ==============================================================
        public function ajax_verify_connection()
        {
            check_ajax_referer('cartee_admin', 'nonce');

            if (empty($this->api_key)) {
                wp_send_json_error(array('message' => 'API key is not set. Save settings first.'));
            }

            $response = wp_remote_get(
                $this->cartee_url . '/api/webhooks/woocommerce/auth',
                array(
                    'headers' => array(
                        'X-API-Key' => $this->api_key,
                        'X-Site-URL' => get_site_url(),
                    ),
                    'timeout' => 15,
                )
            );

            if (is_wp_error($response)) {
                wp_send_json_error(array('message' => $response->get_error_message()));
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if ($code === 200 && !empty($body['success'])) {
                wp_send_json_success(array('message' => 'Connected to Cartee successfully!'));
            } else {
                $msg = isset($body['error']) ? $body['error'] : 'Invalid API key or server unreachable (HTTP ' . $code . ')';
                wp_send_json_error(array('message' => $msg));
            }
        }

        // ==============================================================
        // AJAX: payment confirm (called by Cartee blockchain listener)
        // ==============================================================
        public function ajax_payment_confirm()
        {
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);

            // Fall back to POST params
            $order_key = isset($data['order_key']) ? sanitize_text_field($data['order_key']) : sanitize_text_field($_POST['order_key'] ?? '');
            $transaction_id = isset($data['transaction_id']) ? sanitize_text_field($data['transaction_id']) : sanitize_text_field($_POST['transaction_id'] ?? '');
            $api_key = isset($data['api_key']) ? sanitize_text_field($data['api_key']) : sanitize_text_field($_POST['api_key'] ?? '');

            // Prefer header
            $headers = function_exists('getallheaders') ? getallheaders() : array();
            if (!empty($headers['X-API-Key'])) {
                $api_key = sanitize_text_field($headers['X-API-Key']);
            } elseif (!empty($headers['x-api-key'])) {
                $api_key = sanitize_text_field($headers['x-api-key']);
            }

            // Validate API key
            if ($api_key !== $this->api_key) {
                wp_send_json_error(array('message' => 'Invalid API key'), 401);
            }

            if (empty($order_key)) {
                wp_send_json_error(array('message' => 'order_key required'), 400);
            }

            $order_id = wc_get_order_id_by_order_key($order_key);
            if (!$order_id) {
                wp_send_json_error(array('message' => 'Order not found'), 404);
            }

            $order = wc_get_order($order_id);
            if (!$order) {
                wp_send_json_error(array('message' => 'Invalid order'), 404);
            }

            $order->payment_complete($transaction_id);
            $order->update_status(
                'processing',
                sprintf(
                    /* translators: %s: blockchain transaction hash */
                    __('Payment confirmed via Cartee (on-chain). Tx: %s', 'cartee-gateway'),
                    $transaction_id
                )
            );

            wp_send_json_success(array(
                'message' => 'Order marked as paid',
                'order_id' => $order_id,
                'status' => $order->get_status(),
            ));
        }

        // ==============================================================
        // Helpers
        // ==============================================================
        private function get_product_names($order)
        {
            $names = array();
            foreach ($order->get_items() as $item) {
                $names[] = $item->get_name();
            }
            return implode(', ', $names);
        }
    }

    // Register the gateway
    add_filter('woocommerce_payment_gateways', function ($gateways) {
        $gateways[] = 'WC_Gateway_Cartee';
        return $gateways;
    });

    // Settings shortcut link on plugins page
    add_filter(
        'plugin_action_links_' . plugin_basename(__FILE__),
        function ($links) {
            $url = admin_url('admin.php?page=wc-settings&tab=checkout&section=cartee_gateway');
            array_unshift($links, '<a href="' . esc_url($url) . '">' . __('Settings', 'cartee-gateway') . '</a>');
            return $links;
        }
    );
}

// ------------------------------------------------------------------
// Declare HPOS compatibility
// ------------------------------------------------------------------
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

// ------------------------------------------------------------------
// Activation guard
// ------------------------------------------------------------------
register_activation_hook(__FILE__, function () {
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(esc_html__('Cartee requires WooCommerce to be installed and active.', 'cartee-gateway'));
    }
});

// ------------------------------------------------------------------
// Order-received page — custom thank-you message
// ------------------------------------------------------------------
add_filter('woocommerce_thankyou_order_received_text', function ($text, $order) {
    if ($order && $order->get_payment_method() === 'cartee_gateway') {
        if ($order->get_status() === 'processing') {
            return __('🎉 Your Cartee payment was confirmed on-chain! Your order is now being processed.', 'cartee-gateway');
        }
        if ($order->get_status() === 'on-hold') {
            return __('Thank you! Your order is created. Please complete your Cartee payment to confirm it.', 'cartee-gateway');
        }
    }
    return $text;
}, 10, 2);
