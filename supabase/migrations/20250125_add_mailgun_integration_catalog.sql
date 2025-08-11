-- Add Mailgun to Integration Catalog
-- Date: January 25, 2025

-- First, let's find the messaging category ID or create it if it doesn't exist
DO $$
DECLARE
    messaging_category_id UUID;
    mailgun_integration_id UUID;
BEGIN
    -- Get or create Messaging & Communication category
    SELECT id INTO messaging_category_id 
    FROM integration_categories 
    WHERE name = 'Messaging & Communication';
    
    IF messaging_category_id IS NULL THEN
        INSERT INTO integration_categories (
            name,
            description,
            icon_name,
            display_order,
            is_active
        ) VALUES (
            'Messaging & Communication',
            'Email, SMS, chat, and communication tools',
            'MessageSquare',
            3,
            true
        ) RETURNING id INTO messaging_category_id;
    END IF;
    
    -- Check if Mailgun integration already exists
    SELECT id INTO mailgun_integration_id
    FROM integrations
    WHERE name = 'Mailgun';
    
    -- Insert Mailgun integration if it doesn't exist
    IF mailgun_integration_id IS NULL THEN
        INSERT INTO integrations (
            category_id,
            name,
            description,
            icon_name,
            status,
            is_popular,
            documentation_url,
            configuration_schema,
            created_at,
            updated_at
        ) VALUES (
            messaging_category_id,
            'Mailgun',
            'High-deliverability email sending with advanced validation, analytics, and inbound routing capabilities',
            'Mail',
            'available',
            true,
            'https://documentation.mailgun.com/en/latest/api_reference.html',
            '{
                "type": "object",
                "properties": {
                    "domain": {
                        "type": "string",
                        "title": "Mailgun Domain",
                        "description": "Your verified Mailgun sending domain"
                    },
                    "api_key": {
                        "type": "string",
                        "title": "API Key",
                        "description": "Your Mailgun API key (starts with key-)",
                        "format": "password"
                    },
                    "region": {
                        "type": "string",
                        "title": "Region",
                        "description": "Mailgun region",
                        "enum": ["us", "eu"],
                        "default": "us"
                    }
                },
                "required": ["domain", "api_key"]
            }'::jsonb,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Mailgun integration added successfully';
    ELSE
        RAISE NOTICE 'Mailgun integration already exists';
    END IF;
END$$;

-- Also ensure SendGrid exists in case it's missing
DO $$
DECLARE
    messaging_category_id UUID;
    sendgrid_integration_id UUID;
BEGIN
    -- Get messaging category ID
    SELECT id INTO messaging_category_id 
    FROM integration_categories 
    WHERE name = 'Messaging & Communication';
    
    -- Check if SendGrid integration already exists
    SELECT id INTO sendgrid_integration_id
    FROM integrations
    WHERE name = 'SendGrid';
    
    -- Insert SendGrid integration if it doesn't exist
    IF sendgrid_integration_id IS NULL THEN
        INSERT INTO integrations (
            category_id,
            name,
            description,
            icon_name,
            status,
            is_popular,
            documentation_url,
            configuration_schema,
            created_at,
            updated_at
        ) VALUES (
            messaging_category_id,
            'SendGrid',
            'Send and receive emails via SendGrid API with agent inboxes and smart routing',
            'Mail',
            'available',
            true,
            'https://docs.sendgrid.com/api-reference',
            '{
                "type": "object",
                "properties": {
                    "api_key": {
                        "type": "string",
                        "title": "SendGrid API Key",
                        "description": "Your SendGrid API key (starts with SG.)",
                        "format": "password"
                    },
                    "from_email": {
                        "type": "string",
                        "title": "From Email",
                        "description": "Default from email address",
                        "format": "email"
                    },
                    "from_name": {
                        "type": "string",
                        "title": "From Name",
                        "description": "Default from name (optional)"
                    }
                },
                "required": ["api_key", "from_email"]
            }'::jsonb,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'SendGrid integration added successfully';
    ELSE
        RAISE NOTICE 'SendGrid integration already exists';
    END IF;
END$$;
