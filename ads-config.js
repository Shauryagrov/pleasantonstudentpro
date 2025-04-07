// Ads Configuration
const AdsConfig = {
    // Ad unit IDs - Replace these with your actual AdSense unit IDs
    adUnits: {
        sidebar: 'ca-pub-XXXXXXXXXXXXXXXX',
        inContent: 'ca-pub-XXXXXXXXXXXXXXXX',
        banner: 'ca-pub-XXXXXXXXXXXXXXXX'
    },

    // Ad sizes
    adSizes: {
        sidebar: '300x600',
        inContent: '728x90',
        banner: '970x250'
    },

    // Initialize ads
    initAds: function() {
        // Add AdSense script
        const adScript = document.createElement('script');
        adScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        adScript.setAttribute('async', 'true');
        adScript.setAttribute('crossorigin', 'anonymous');
        document.head.appendChild(adScript);

        // Initialize AdSense
        window.adsbygoogle = window.adsbygoogle || [];
        
        // Load all ad units
        document.querySelectorAll('.adsbygoogle').forEach(ad => {
            (adsbygoogle = window.adsbygoogle || []).push({});
        });
    },

    // Create ad container
    createAdContainer: function(type) {
        const container = document.createElement('div');
        container.className = `ad-container ${type}-ad`;
        
        const adElement = document.createElement('ins');
        adElement.className = 'adsbygoogle';
        adElement.style.display = 'block';
        adElement.setAttribute('data-ad-client', this.adUnits[type]);
        adElement.setAttribute('data-ad-slot', '');  // Add your ad slot ID
        adElement.setAttribute('data-ad-format', 'auto');
        adElement.setAttribute('data-full-width-responsive', 'true');
        
        container.appendChild(adElement);
        return container;
    },

    // Check if user is premium
    isPremiumUser: async function() {
        try {
            const response = await fetch('/api/check-premium-status');
            const status = await response.json();
            return status.adFree || false;
        } catch (error) {
            console.error('Error checking premium status:', error);
            return false;
        }
    },

    // Show or hide ads based on premium status
    updateAdsVisibility: async function() {
        const isPremium = await this.isPremiumUser();
        const adContainers = document.querySelectorAll('.ad-container');
        
        adContainers.forEach(container => {
            container.style.display = isPremium ? 'none' : 'block';
        });
    }
};

// Export the config
window.AdsConfig = AdsConfig; 