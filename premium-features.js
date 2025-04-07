// Premium Features Integration
const STRIPE_PUBLIC_KEY = 'YOUR_STRIPE_PUBLIC_KEY';

// Premium feature flags
const premiumFeatures = {
    analyticsEnabled: false,
    adFree: false,
    extendedHistory: false,
    prioritySupport: false
};

// Premium subscription tiers
const subscriptionTiers = {
    basic: {
        price: 4.99,
        features: ['Basic Analytics', 'Ad-Free Experience'],
        stripePrice: 'price_basic'
    },
    pro: {
        price: 9.99,
        features: ['Advanced Analytics', 'Ad-Free Experience', 'Extended Grade History', 'Priority Support'],
        stripePrice: 'price_pro'
    }
};

// Initialize Stripe
let stripe;

async function initializeStripe() {
    stripe = Stripe(STRIPE_PUBLIC_KEY);
}

// Handle subscription purchase
async function subscribeToPremium(tier) {
    try {
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: subscriptionTiers[tier].stripePrice,
            }),
        });

        const session = await response.json();
        const result = await stripe.redirectToCheckout({
            sessionId: session.id,
        });

        if (result.error) {
            console.error(result.error);
            alert('Failed to process payment. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again later.');
    }
}

// Check premium status
async function checkPremiumStatus() {
    try {
        const response = await fetch('/check-premium-status');
        const status = await response.json();
        
        Object.keys(premiumFeatures).forEach(feature => {
            premiumFeatures[feature] = status[feature] || false;
        });
        
        updateUI();
    } catch (error) {
        console.error('Error checking premium status:', error);
    }
}

// Update UI based on premium status
function updateUI() {
    const premiumElements = document.querySelectorAll('.premium-feature');
    premiumElements.forEach(element => {
        const feature = element.dataset.feature;
        if (premiumFeatures[feature]) {
            element.classList.remove('locked');
            element.classList.add('unlocked');
        } else {
            element.classList.remove('unlocked');
            element.classList.add('locked');
        }
    });
}

// Initialize premium features
document.addEventListener('DOMContentLoaded', () => {
    initializeStripe();
    checkPremiumStatus();
}); 