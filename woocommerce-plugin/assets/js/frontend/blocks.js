const { registerPaymentMethod } = wc.wcBlocksRegistry;
const { createElement, Fragment } = wp.element;
const { __ } = wp.i18n;
const { decodeEntities } = wp.htmlEntities;
const { getSetting } = wc.wcSettings;

const settings = getSetting('MNEE_gateway_data', {});
const defaultLabel = __('MNEE Stablecoin', 'wc-MNEE-gateway');
const label = decodeEntities(settings.title) || defaultLabel;

/**
 * Content component for MNEE Gateway
 */
const Content = () => {
    return createElement(
        'div',
        {
            style: {
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
                marginTop: '10px'
            }
        },
        createElement(
            'p',
            { style: { margin: '0', fontSize: '14px' } },
            __('You will complete the payment with your wallet after being redirected to Ethereum Commerce.', 'wc-MNEE-gateway')
        )
    );
};

/**
 * Label component for MNEE Gateway
 */
const Label = () => {
    return createElement(
        'span',
        {
            style: {
                display: 'flex',
                alignItems: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1a1a1a'
            }
        },
        label
    );
};

/**
 * MNEE payment method config object.
 */
const MNEEPaymentMethod = {
    name: 'MNEE_gateway',
    label: createElement(Label),
    content: createElement(Content),
    edit: createElement(Content),
    canMakePayment: () => true,
    ariaLabel: label,
    supports: {
        features: settings.supports || ['products']
    }
};

registerPaymentMethod(MNEEPaymentMethod);