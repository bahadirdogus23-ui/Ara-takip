-- 3. aşama: taşeron / kiralık araç hakedişi için ücret alanları. Yalnızca yeni sütunlar.

-- Kime ödeme yapılacağı (taşeron ya da kiralayan firma) ve iş makinesi saatlik kirası
alter table public.vehicles
  add column contractor_name text check (length(contractor_name) <= 200),
  add column hourly_rate numeric(12, 2) check (hourly_rate >= 0);

-- Güzergâhta taşerona ödenen sefer başı ücret (TL, KDV hariç)
alter table public.routes
  add column trip_price numeric(12, 2) check (trip_price >= 0);
