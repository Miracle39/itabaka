insert into public.products (code,name,description,price,stock,active,sort_order)
values
('ITB-001','Acrylic Stand','Acrylic stand edisi PO.',75000,50,true,10),
('ITB-002','Keychain','Keychain edisi PO.',35000,100,true,20),
('ITB-003','Print Set','Print set edisi PO.',50000,100,true,30)
on conflict(code) do update set name=excluded.name,description=excluded.description,price=excluded.price,stock=excluded.stock,active=excluded.active,sort_order=excluded.sort_order;
