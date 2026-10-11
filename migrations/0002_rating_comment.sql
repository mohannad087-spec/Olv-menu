-- تعليق الزبون ووقت التقييم مع النجوم
ALTER TABLE orders ADD COLUMN rating_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN rated_at TEXT NOT NULL DEFAULT '';
