-- Create restaurants table (one per admin user)
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Meu Restaurante',
  address TEXT,
  instagram_url TEXT,
  opening_time TEXT DEFAULT '18:00',
  closing_time TEXT DEFAULT '23:00',
  min_order DECIMAL(10,2) DEFAULT 30.00,
  is_open BOOLEAN DEFAULT false,
  delivery_available BOOLEAN DEFAULT true,
  pickup_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  cashback INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for admin users
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  subscription_status TEXT DEFAULT 'trial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for restaurants
CREATE POLICY "Users can view their own restaurant" ON public.restaurants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own restaurant" ON public.restaurants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own restaurant" ON public.restaurants
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for categories
CREATE POLICY "Users can view their restaurant categories" ON public.categories
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create categories for their restaurant" ON public.categories
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update their restaurant categories" ON public.categories
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their restaurant categories" ON public.categories
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

-- RLS policies for products
CREATE POLICY "Users can view their restaurant products" ON public.products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create products for their restaurant" ON public.products
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update their restaurant products" ON public.products
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their restaurant products" ON public.products
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

-- RLS policies for coupons
CREATE POLICY "Users can view their restaurant coupons" ON public.coupons
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create coupons for their restaurant" ON public.coupons
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update their restaurant coupons" ON public.coupons
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their restaurant coupons" ON public.coupons
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND user_id = auth.uid()
  ));

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  
  -- Create a default restaurant for the new user
  INSERT INTO public.restaurants (user_id, name)
  VALUES (new.id, 'Meu Restaurante');
  
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();