insert into public.site_settings(
  id,site_name,site_title,site_description,dp_percentage,bca_account_name,bca_account_number
) values(
  1,'Circle Itabaka','Pre-Order CF24','Pesan merchandise Itabaka untuk CF24.',50,'Nama Pemilik Rekening','0000000000'
) on conflict(id) do update set
  dp_percentage=excluded.dp_percentage,
  bca_account_name=excluded.bca_account_name,
  bca_account_number=excluded.bca_account_number;

insert into public.products(code,name,description,price,stock,active,sort_order) values
('ITB-001','Acrylic Stand','Acrylic stand edisi PO.',75000,50,true,10),
('ITB-002','Keychain','Keychain edisi PO.',35000,100,true,20),
('ITB-003','Print Set','Print set edisi PO.',50000,100,true,30)
on conflict(code) do update set
  name=excluded.name,description=excluded.description,price=excluded.price,stock=excluded.stock,active=excluded.active,sort_order=excluded.sort_order;
