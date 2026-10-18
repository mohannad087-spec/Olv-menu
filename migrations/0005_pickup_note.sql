-- نص «مكان الاستلام» اللي بيطلع للزبون بصفحة «طلبك جاهز» (الكاشير بيبعته مع تبليغ الجاهزية)
ALTER TABLE orders ADD COLUMN pickup_note TEXT NOT NULL DEFAULT '';
