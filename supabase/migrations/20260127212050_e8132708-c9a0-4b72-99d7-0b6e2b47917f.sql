-- Create campaigns table to store WhatsApp marketing campaigns
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_type TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_recipients table to store individual message recipients and their status
CREATE TABLE public.campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Create policies for campaigns
CREATE POLICY "Users can view their restaurant campaigns" 
ON public.campaigns 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = campaigns.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can create campaigns for their restaurant" 
ON public.campaigns 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = campaigns.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can update their restaurant campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = campaigns.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can delete their restaurant campaigns" 
ON public.campaigns 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = campaigns.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

-- Create policies for campaign_recipients
CREATE POLICY "Users can view their campaign recipients" 
ON public.campaign_recipients 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM campaigns 
  JOIN restaurants ON restaurants.id = campaigns.restaurant_id 
  WHERE campaigns.id = campaign_recipients.campaign_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can create recipients for their campaigns" 
ON public.campaign_recipients 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns 
  JOIN restaurants ON restaurants.id = campaigns.restaurant_id 
  WHERE campaigns.id = campaign_recipients.campaign_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can update their campaign recipients" 
ON public.campaign_recipients 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM campaigns 
  JOIN restaurants ON restaurants.id = campaigns.restaurant_id 
  WHERE campaigns.id = campaign_recipients.campaign_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can delete their campaign recipients" 
ON public.campaign_recipients 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM campaigns 
  JOIN restaurants ON restaurants.id = campaigns.restaurant_id 
  WHERE campaigns.id = campaign_recipients.campaign_id 
  AND restaurants.user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_campaigns_restaurant_id ON public.campaigns(restaurant_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_scheduled_at ON public.campaigns(scheduled_at);
CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);

-- Add trigger for updated_at
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();