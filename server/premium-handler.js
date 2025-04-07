const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Premium subscription handler
class PremiumHandler {
    constructor() {
        this.stripe = stripe;
    }

    // Create a checkout session for subscription
    async createCheckoutSession(priceId) {
        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1,
                }],
                mode: 'subscription',
                success_url: `${process.env.DOMAIN}/premium-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.DOMAIN}/premium-cancel`,
            });
            return session;
        } catch (error) {
            console.error('Error creating checkout session:', error);
            throw error;
        }
    }

    // Verify subscription status
    async verifySubscription(userId) {
        try {
            const subscriptions = await this.stripe.subscriptions.list({
                customer: userId,
                status: 'active',
            });
            return subscriptions.data.length > 0;
        } catch (error) {
            console.error('Error verifying subscription:', error);
            return false;
        }
    }

    // Handle webhook events
    async handleWebhook(event) {
        try {
            switch (event.type) {
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCanceled(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
            }
        } catch (error) {
            console.error('Error handling webhook:', error);
            throw error;
        }
    }

    // Handle subscription creation
    async handleSubscriptionCreated(subscription) {
        // Update user's premium status in database
        // This is where you'd implement your database updates
        console.log('Subscription created:', subscription.id);
    }

    // Handle subscription cancellation
    async handleSubscriptionCanceled(subscription) {
        // Update user's premium status in database
        // This is where you'd implement your database updates
        console.log('Subscription canceled:', subscription.id);
    }

    // Handle subscription updates
    async handleSubscriptionUpdated(subscription) {
        // Update user's premium status in database
        // This is where you'd implement your database updates
        console.log('Subscription updated:', subscription.id);
    }
}

module.exports = PremiumHandler; 