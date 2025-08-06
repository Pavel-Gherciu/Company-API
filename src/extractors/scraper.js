async function scrapeInfo(page) {
  return await page.evaluate(() => {

    let scriptData = {
      phone: null,
      address: null,
      socialMedia: null,
      foundInScript: false
    };
    
    // script check
    const jsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonScripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
          // script phone
          if (item.telephone && !scriptData.phone) {
            scriptData.phone = item.telephone.replace(/^\+\s*/, '').trim();
            scriptData.foundInScript = true;
          }
          
          // script address
          if (item.address && !scriptData.address) {
            let parts = [];
            if (typeof item.address === 'string') {
              scriptData.address = item.address;
            } else if (typeof item.address === 'object') {
              if (item.address.streetAddress) parts.push(item.address.streetAddress);
              if (item.address.addressLocality) parts.push(item.address.addressLocality);
              if (item.address.addressRegion) parts.push(item.address.addressRegion);
              if (item.address.postalCode) parts.push(item.address.postalCode);
              if (item.address.addressCountry) parts.push(item.address.addressCountry);
              
              if (parts.length > 0) {
                scriptData.address = parts.join(', ');
              }
            }
            if (scriptData.address) {
              scriptData.foundInScript = true;
            }
          }
          
          // links if found (rare)
          if (item.sameAs && Array.isArray(item.sameAs) && !scriptData.socialMedia) {
            const socialUrls = item.sameAs.filter(url => 
              url.includes('facebook.com') ||
              url.includes('twitter.com') ||
              url.includes('instagram.com') ||
              url.includes('linkedin.com') ||
              url.includes('youtube.com')
            );
            if (socialUrls.length > 0) {
              scriptData.socialMedia = socialUrls.join(', ');
              scriptData.foundInScript = true;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // phone selectors
    const phoneSelectors = [
      'a[href*="tel:"]',
      '.phone',
      '.contact-phone',
      '.hotline'
    ];
    
    // social media selectors
    const socialSelectors = [
      'a[href*="facebook.com"]',
      'a[href*="twitter.com"]',
      'a[href*="instagram.com"]',
      'a[href*="linkedin.com"]',
      'a[href*="youtube.com"]',
      '.social-media a',
      '[class*="social"] a'
    ];
    
    // address/location selectors
    const addressSelectors = [
      '.contact-widget',
      '.address',
      '.location',
      '.contact-address',
      '[data-type="address"]',
      '[class*="address"]',
      '[itemtype*="PostalAddress"]',
      '[itemprop="address"]',
      '[href*="maps"]'
    ];
    
    // phone number scraping
    let phone = scriptData.phone;
    if (!phone) {
      for (const selector of phoneSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          let phoneText = element.href?.replace('tel:', '') || element.textContent.trim() || null;
          if (phoneText) {
            // clean up phone
            phoneText = phoneText.replace(/\s*x\d+$/i, ''); // extensions like "x5546"
            phoneText = phoneText.replace(/^(call|phone|tel|telephone)\s*/i, ''); // prefixes
            phoneText = phoneText.replace(/["']/g, ''); // quotes
            phoneText = phoneText.trim();
            
            // proper phone format check
            if (phoneText && /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/.test(phoneText)) {
              phone = phoneText;
              break;
            }
          }
        }
      }
    }
    
    // phone regex if selectors fialed
    if (!phone) {
      const bodyText = document.body ? document.body.innerText : '';
      
      // phone patterns
      const phonePatterns = [
        // usa phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, 123 456 7890
        /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        // international format: +1 123 456 7890, +44 20 1234 5678
        /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
        // toll free numbers: 800-123-4567, 1-800-123-4567
        /\b(?:1[-.\s]?)?(?:800|888|877|866|855|844|833|822)[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        // simple 10-digit numbers: 1234567890
        /\b\d{10}\b/g
      ];
      
      let foundPhones = [];
      
      for (const pattern of phonePatterns) {
        const matches = bodyText.match(pattern);
        if (matches) {
          foundPhones = foundPhones.concat(matches);
        }
      }
      
      // filter phones
      if (foundPhones.length > 0) {
        // filter invalid numbers like years and IDs
        const goodPhones = foundPhones.filter(phoneNum => {
          const digits = phoneNum.replace(/\D/g, '');
          // must be 10-15 digits, can't start with 0 or 1 for usa numbers
          return digits.length >= 10 && digits.length <= 15 && 
                 !digits.startsWith('0') && 
                 !(digits.length === 10 && digits.startsWith('1'));
        });
        
        if (goodPhones.length > 0) {
          let cleanPhone = goodPhones[0].trim();
          cleanPhone = cleanPhone.replace(/\s*x\d+$/i, '');
          cleanPhone = cleanPhone.replace(/^(call|phone|tel|telephone)\s*/i, '');
          cleanPhone = cleanPhone.replace(/["']/g, '');
          phone = cleanPhone.trim();
        }
      }
    }
    
    // social media scraping
    let socialLinks = [];
    if (scriptData.socialMedia) {
      socialLinks = scriptData.socialMedia.split(', ');
    }
    
    if (socialLinks.length === 0) {
      for (const selector of socialSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.href && socialLinks.length < 8) {
            socialLinks.push(el.href);
          }
        });
        if (socialLinks.length >= 8) break;
      }
    }
    
    // only links allowed
    socialLinks = socialLinks.filter(link => link.startsWith('http'));
    
    // address scraping
    let address = scriptData.address;
    
    // address patterns for validation
    const addressPatterns = [
      // address with street, city, state, zip, country (e.g., "210 Apples Church Road, Thurmont, Maryland 21788, United States")
      /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,50}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Court|Ct|Place|Pl)\.?,\s*(?:#\d+|Suite\s*\d+|Unit\s*\d+|Apt\s*\d+)?,?\s*[A-Za-z\s,]{10,100}(?:\d{5}(?:-\d{4})?)?/gi,
      // address with street, suite/unit, city, state, zip (e.g., "3904 Convoy St., #108, San Diego, CA 92111")
      /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,50}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Court|Ct|Place|Pl)\.?,\s*(?:#\d+|Suite\s*\d+|Unit\s*\d+|Apt\s*\d+)?,\s*[A-Za-z\s]{3,50},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/gi,
      // address with suite/unit, must have comma (e.g., "123 Main St, Suite 200" or "456 Oak Avenue, #200")
      /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,50}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Court|Ct|Place|Pl)\.?,\s*(?:#\d+|Suite\s*\d+|Unit\s*\d+|Apt\s*\d+)/gi,
      // City, State, ZIP format (e.g., "San Diego, CA 92111") - must have realistic structure
      /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
      // PO Box patterns with comma (e.g., "P.O. Box 123, City, State")
      /\bP\.?O\.?\s*Box\s+\d+,\s*[A-Za-z\s]+/gi
    ];
    
    // structure validation
    const isGoodAddress = (text) => {
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      // length check
      if (cleanText.length < 8 || cleanText.length > 200) {
        return false;
      }
      
      // must contain at least one comma (filters out majority of fakes even if some real ones dont have commas)
      if (!cleanText.includes(',')) {
        return false;
      }
      
      // has to contain at least:
      // 1. street number + street type
      // 2. city, state pattern 
      // 3. PO Box
      const hasStreetNumber = /\b\d{1,5}\s+[A-Za-z]/.test(cleanText);
      const hasStreetType = /(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Court|Ct|Place|Pl)\b/i.test(cleanText);
      const hasCityState = /\b[A-Za-z]{3,},\s*[A-Z]{2}\b/.test(cleanText);
      const hasPOBox = /\bP\.?O\.?\s*Box\s+\d+/i.test(cleanText);
      const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(cleanText);
      
      // valid if it has proper address structure
      const isStreetAddress = hasStreetNumber && hasStreetType;
      const isCityStateZip = hasCityState && hasZip;
      const isCityState = hasCityState;
      const isPOBox = hasPOBox;
      
      return isStreetAddress || isCityStateZip || isCityState || isPOBox;
    };
    
    // now css selectors if not found in script
    if (!address) {
      for (const selector of addressSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const addressText = element.textContent.trim();
          if (addressText && isGoodAddress(addressText)) {
            address = addressText;
            address = address.replace(/\s+/g, ' ').trim();
            if (address.length > 200) {
              address = address.substring(0, 200).trim();
            }
            break;
          }
        }
      }
    }
    
    // body text match
    if (!address) {
      const bodyText = document.body ? document.body.innerText : '';
      
      let foundAddresses = [];
      
      for (const pattern of addressPatterns) {
        const matches = bodyText.match(pattern);
        if (matches) {
          foundAddresses = foundAddresses.concat(matches);
        }
      }
      
      if (foundAddresses.length > 0) {
        address = foundAddresses
          .filter(addr => addr.length > 10)
          .sort((a, b) => b.length - a.length)[0];
        
        if (address) {
          address = address.replace(/\s+/g, ' ').trim();
          if (address.length > 200) {
            address = address.substring(0, 200).trim();
          }
        }
      }
    }
    
    return {
      phone: phone,
      socialMedia: socialLinks.length > 0 ? socialLinks.join(', ') : null,
      address: address,
      foundInScript: scriptData.foundInScript
    };
  });
}

module.exports = {
  scrapeInfo
};
