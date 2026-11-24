-- Constraints and company isolation. Transactions required.
SET search_path = app, public;

ALTER TABLE app."company" ADD CONSTRAINT "uq_company_company_code" UNIQUE ("company_code");
ALTER TABLE app."organization_unit" ADD CONSTRAINT "uq_organization_unit_company_code_unit_code" UNIQUE ("company_code", "unit_code");
ALTER TABLE app."position" ADD CONSTRAINT "uq_position_company_code_position_code" UNIQUE ("company_code", "position_code");
ALTER TABLE app."employee" ADD CONSTRAINT "uq_employee_company_code_employee_no" UNIQUE ("company_code", "employee_no");
ALTER TABLE app."system_role" ADD CONSTRAINT "uq_system_role_company_code_role_code" UNIQUE ("company_code", "role_code");
ALTER TABLE app."farm_batch" ADD CONSTRAINT "uq_farm_batch_company_code_batch_no" UNIQUE ("company_code", "batch_no");
ALTER TABLE app."house_pen" ADD CONSTRAINT "uq_house_pen_company_code_house_code" UNIQUE ("company_code", "house_code");
ALTER TABLE app."vaccination_program" ADD CONSTRAINT "uq_vaccination_program_company_code_program_code" UNIQUE ("company_code", "program_code");
ALTER TABLE app."quarantine_certificate" ADD CONSTRAINT "uq_quarantine_certificate_company_code_cert_no" UNIQUE ("company_code", "cert_no");
ALTER TABLE app."purchase_requisition" ADD CONSTRAINT "uq_purchase_requisition_company_code_requisition_no" UNIQUE ("company_code", "requisition_no");
ALTER TABLE app."purchase_order" ADD CONSTRAINT "uq_purchase_order_company_code_order_no" UNIQUE ("company_code", "order_no");
ALTER TABLE app."supplier" ADD CONSTRAINT "uq_supplier_company_code_supplier_code" UNIQUE ("company_code", "supplier_code");
ALTER TABLE app."goods_receipt" ADD CONSTRAINT "uq_goods_receipt_company_code_receipt_no" UNIQUE ("company_code", "receipt_no");
ALTER TABLE app."material" ADD CONSTRAINT "uq_material_company_code_material_code" UNIQUE ("company_code", "material_code");
ALTER TABLE app."inbound_record" ADD CONSTRAINT "uq_inbound_record_company_code_inbound_no" UNIQUE ("company_code", "inbound_no");
ALTER TABLE app."outbound_record" ADD CONSTRAINT "uq_outbound_record_company_code_outbound_no" UNIQUE ("company_code", "outbound_no");
ALTER TABLE app."warehouse_location" ADD CONSTRAINT "uq_warehouse_location_company_code_warehouse_code" UNIQUE ("company_code", "warehouse_code");
ALTER TABLE app."stocktake_record" ADD CONSTRAINT "uq_stocktake_record_company_code_stocktake_no" UNIQUE ("company_code", "stocktake_no");
ALTER TABLE app."batch_expiry" ADD CONSTRAINT "uq_batch_expiry_company_code_batch_no" UNIQUE ("company_code", "batch_no");
ALTER TABLE app."customer" ADD CONSTRAINT "uq_customer_company_code_customer_code" UNIQUE ("company_code", "customer_code");
ALTER TABLE app."price_list" ADD CONSTRAINT "uq_price_list_company_code_price_list_code" UNIQUE ("company_code", "price_list_code");
ALTER TABLE app."sales_order" ADD CONSTRAINT "uq_sales_order_company_code_order_no" UNIQUE ("company_code", "order_no");
ALTER TABLE app."delivery_task" ADD CONSTRAINT "uq_delivery_task_company_code_task_no" UNIQUE ("company_code", "task_no");
ALTER TABLE app."vehicle_route" ADD CONSTRAINT "uq_vehicle_route_company_code_vehicle_code" UNIQUE ("company_code", "vehicle_code");
ALTER TABLE app."equipment" ADD CONSTRAINT "uq_equipment_company_code_equipment_code" UNIQUE ("company_code", "equipment_code");
ALTER TABLE app."spare_part" ADD CONSTRAINT "uq_spare_part_company_code_spare_part_code" UNIQUE ("company_code", "spare_part_code");
ALTER TABLE app."metric_definition" ADD CONSTRAINT "uq_metric_definition_company_code_metric_code" UNIQUE ("company_code", "metric_code");
ALTER TABLE app."report_record" ADD CONSTRAINT "uq_report_record_company_code_report_no" UNIQUE ("company_code", "report_no");
ALTER TABLE app."print_template" ADD CONSTRAINT "uq_print_template_company_code_template_code" UNIQUE ("company_code", "template_code");
ALTER TABLE app."print_job" ADD CONSTRAINT "uq_print_job_company_code_job_no" UNIQUE ("company_code", "job_no");
ALTER TABLE app."term_enum" ADD CONSTRAINT "uq_term_enum_company_code_term_code" UNIQUE ("company_code", "term_code");
ALTER TABLE app."outbox_event" ADD CONSTRAINT "uq_outbox_event_event_id" UNIQUE ("event_id");
ALTER TABLE app."idempotency_consumption" ADD CONSTRAINT "uq_idempotency_consumption_company_id_consumer_name_id_e2ec000d" UNIQUE ("company_id", "consumer_name", "idempotency_key");
ALTER TABLE app."idempotency_consumption" ADD CONSTRAINT "uq_idempotency_consumption_company_id_consumer_name_event_id" UNIQUE ("company_id", "consumer_name", "event_id");
ALTER TABLE app."task_status" ADD CONSTRAINT "uq_task_status_company_id_task_type_task_id" UNIQUE ("company_id", "task_type", "task_id");
ALTER TABLE app."task_status" ADD CONSTRAINT "uq_task_status_company_id_task_type_idempotency_key" UNIQUE ("company_id", "task_type", "idempotency_key");
ALTER TABLE app."organization_unit" ADD CONSTRAINT "ck_organization_unit_org_level" CHECK ("org_level" >= 1);
ALTER TABLE app."position" ADD CONSTRAINT "ck_position_headcount" CHECK ("headcount" >= 0);
ALTER TABLE app."employee" ADD CONSTRAINT "ck_employee_account" CHECK ("account" >= 0);
ALTER TABLE app."farm_batch" ADD CONSTRAINT "ck_farm_batch_initial_quantity" CHECK ("initial_quantity" >= 0);
ALTER TABLE app."farm_batch" ADD CONSTRAINT "ck_farm_batch_day_age" CHECK ("day_age" >= 0);
ALTER TABLE app."house_pen" ADD CONSTRAINT "ck_house_pen_pen_count" CHECK ("pen_count" >= 0);
ALTER TABLE app."house_pen" ADD CONSTRAINT "ck_house_pen_floor_count" CHECK ("floor_count" >= 0);
ALTER TABLE app."chick_receipt" ADD CONSTRAINT "ck_chick_receipt_count_quantity" CHECK ("count_quantity" >= 0);
ALTER TABLE app."chick_receipt" ADD CONSTRAINT "ck_chick_receipt_avg_weight" CHECK ("avg_weight" > 0);
ALTER TABLE app."chick_receipt" ADD CONSTRAINT "ck_chick_receipt_gifted_quantity" CHECK ("gifted_quantity" >= 0);
ALTER TABLE app."feeding_record" ADD CONSTRAINT "ck_feeding_record_first_drink_feed" CHECK ("first_drink_feed" >= 0);
ALTER TABLE app."feeding_record" ADD CONSTRAINT "ck_feeding_record_daily_feeding" CHECK ("daily_feeding" >= 0);
ALTER TABLE app."feeding_record" ADD CONSTRAINT "ck_feeding_record_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."environment_record" ADD CONSTRAINT "ck_environment_record_ventilation" CHECK ("ventilation" >= 0);
ALTER TABLE app."environment_record" ADD CONSTRAINT "ck_environment_record_threshold" CHECK ("threshold" >= 0);
ALTER TABLE app."weighing_record" ADD CONSTRAINT "ck_weighing_record_sample_size" CHECK ("sample_size" > 0);
ALTER TABLE app."weighing_record" ADD CONSTRAINT "ck_weighing_record_avg_weight" CHECK ("avg_weight" > 0);
ALTER TABLE app."weighing_record" ADD CONSTRAINT "ck_weighing_record_uniformity" CHECK (("uniformity" >= 0 AND "uniformity" <= 100));
ALTER TABLE app."weighing_record" ADD CONSTRAINT "ck_weighing_record_feeding_group_advice" CHECK ("feeding_group_advice" >= 0);
ALTER TABLE app."transfer_record" ADD CONSTRAINT "ck_transfer_record_headcount_check" CHECK ("headcount_check" >= 0);
ALTER TABLE app."mortality_cull_record" ADD CONSTRAINT "ck_mortality_cull_record_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."mortality_cull_record" ADD CONSTRAINT "ck_mortality_cull_record_stock_update" CHECK ("stock_update" >= 0);
ALTER TABLE app."vaccination_task" ADD CONSTRAINT "ck_vaccination_task_day_age" CHECK ("day_age" >= 0);
ALTER TABLE app."vaccination_execution" ADD CONSTRAINT "ck_vaccination_execution_planned_day_age" CHECK ("planned_day_age" >= 0);
ALTER TABLE app."vaccination_execution" ADD CONSTRAINT "ck_vaccination_execution_actual_day_age" CHECK ("actual_day_age" >= 0);
ALTER TABLE app."vaccination_execution" ADD CONSTRAINT "ck_vaccination_execution_dosage" CHECK ("dosage" > 0);
ALTER TABLE app."vaccination_execution" ADD CONSTRAINT "ck_vaccination_execution_stock_quantity" CHECK ("stock_quantity" >= 0);
ALTER TABLE app."vaccine_requisition" ADD CONSTRAINT "ck_vaccine_requisition_requisition_quantity" CHECK ("requisition_quantity" >= 0);
ALTER TABLE app."vaccine_requisition" ADD CONSTRAINT "ck_vaccine_requisition_stock_deduction" CHECK ("stock_deduction" >= 0);
ALTER TABLE app."medication_prescription" ADD CONSTRAINT "ck_medication_prescription_usage_dosage" CHECK ("usage_dosage" > 0);
ALTER TABLE app."medication_prescription" ADD CONSTRAINT "ck_medication_prescription_exception_feedback" CHECK ("exception_feedback" >= 0);
ALTER TABLE app."withdrawal_period_record" ADD CONSTRAINT "ck_withdrawal_period_record_withdrawal_days" CHECK ("withdrawal_days" >= 0);
ALTER TABLE app."purchase_requisition" ADD CONSTRAINT "ck_purchase_requisition_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."purchase_order" ADD CONSTRAINT "ck_purchase_order_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."purchase_order" ADD CONSTRAINT "ck_purchase_order_price" CHECK ("price" >= 0);
ALTER TABLE app."goods_receipt" ADD CONSTRAINT "ck_goods_receipt_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."inventory_ledger" ADD CONSTRAINT "ck_inventory_ledger_quantity" CHECK ("quantity" >= 0);
ALTER TABLE app."inbound_record" ADD CONSTRAINT "ck_inbound_record_egg_quantity" CHECK ("egg_quantity" >= 0);
ALTER TABLE app."stocktake_record" ADD CONSTRAINT "ck_stocktake_record_book_quantity" CHECK ("book_quantity" >= 0);
ALTER TABLE app."stocktake_record" ADD CONSTRAINT "ck_stocktake_record_actual_quantity" CHECK ("actual_quantity" >= 0);
ALTER TABLE app."safety_stock" ADD CONSTRAINT "ck_safety_stock_threshold_value" CHECK ("threshold_value" >= 0);
ALTER TABLE app."customer" ADD CONSTRAINT "ck_customer_payment_term" CHECK ("payment_term" >= 0);
ALTER TABLE app."price_list" ADD CONSTRAINT "ck_price_list_price" CHECK ("price" >= 0);
ALTER TABLE app."sales_order" ADD CONSTRAINT "ck_sales_order_inventory_quantity" CHECK ("inventory_quantity" >= 0);
ALTER TABLE app."credit_limit" ADD CONSTRAINT "ck_credit_limit_credit_amount" CHECK ("credit_amount" >= 0);
ALTER TABLE app."credit_limit" ADD CONSTRAINT "ck_credit_limit_occupied_amount" CHECK ("occupied_amount" >= 0);
ALTER TABLE app."payment_term_exception" ADD CONSTRAINT "ck_payment_term_exception_payment_term" CHECK ("payment_term" >= 0);
ALTER TABLE app."payment_term_exception" ADD CONSTRAINT "ck_payment_term_exception_threshold_value" CHECK ("threshold_value" >= 0);
ALTER TABLE app."receivable" ADD CONSTRAINT "ck_receivable_payment_term" CHECK ("payment_term" >= 0);
ALTER TABLE app."receivable" ADD CONSTRAINT "ck_receivable_receivable_balance" CHECK ("receivable_balance" >= 0);
ALTER TABLE app."receipt_record" ADD CONSTRAINT "ck_receipt_record_cash_amount" CHECK ("cash_amount" >= 0);
ALTER TABLE app."receipt_record" ADD CONSTRAINT "ck_receipt_record_check_amount" CHECK ("check_amount" >= 0);
ALTER TABLE app."receipt_record" ADD CONSTRAINT "ck_receipt_record_bank_credit" CHECK ("bank_credit" >= 0);
ALTER TABLE app."receipt_record" ADD CONSTRAINT "ck_receipt_record_writeoff" CHECK ("writeoff" >= 0);
ALTER TABLE app."receipt_record" ADD CONSTRAINT "ck_receipt_record_overpay_balance" CHECK ("overpay_balance" >= 0);
ALTER TABLE app."cash_checkbook" ADD CONSTRAINT "ck_cash_checkbook_cash_amount" CHECK ("cash_amount" >= 0);
ALTER TABLE app."payable" ADD CONSTRAINT "ck_payable_payable_balance" CHECK ("payable_balance" >= 0);
ALTER TABLE app."payable" ADD CONSTRAINT "ck_payable_payment_term" CHECK ("payment_term" >= 0);
ALTER TABLE app."payable" ADD CONSTRAINT "ck_payable_withholding_tax_amount" CHECK ("withholding_tax_amount" >= 0);
ALTER TABLE app."payment_record" ADD CONSTRAINT "ck_payment_record_check_amount" CHECK ("check_amount" >= 0);
ALTER TABLE app."payment_record" ADD CONSTRAINT "ck_payment_record_writeoff" CHECK ("writeoff" >= 0);
ALTER TABLE app."cost_allocation" ADD CONSTRAINT "ck_cost_allocation_attendance" CHECK ("attendance" >= 0);
ALTER TABLE app."cost_allocation" ADD CONSTRAINT "ck_cost_allocation_salary" CHECK ("salary" >= 0);
ALTER TABLE app."cost_allocation" ADD CONSTRAINT "ck_cost_allocation_expense_account" CHECK ("expense_account" >= 0);
ALTER TABLE app."disbursement_voucher" ADD CONSTRAINT "ck_disbursement_voucher_withholding_tax_amount" CHECK ("withholding_tax_amount" >= 0 AND "withholding_tax_amount" <= "gross_amount");
ALTER TABLE app."equipment_check" ADD CONSTRAINT "ck_equipment_check_check_standard" CHECK ("check_standard" >= 0);
ALTER TABLE app."maintenance_work_order" ADD CONSTRAINT "ck_maintenance_work_order_work_hours" CHECK ("work_hours" >= 0);
ALTER TABLE app."spare_part" ADD CONSTRAINT "ck_spare_part_inventory_quantity" CHECK ("inventory_quantity" >= 0);
ALTER TABLE app."print_job" ADD CONSTRAINT "ck_print_job_reprint_count" CHECK ("reprint_count" >= 0);
ALTER TABLE app."outbox_event" ADD CONSTRAINT "ck_outbox_event_publish_attempts" CHECK ("publish_attempts" >= 0);
ALTER TABLE app."outbox_event" ADD CONSTRAINT "ck_outbox_event_event_version" CHECK ("event_version" >= 0);
ALTER TABLE app."task_status" ADD CONSTRAINT "ck_task_status_progress_percent" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100);
ALTER TABLE app."task_status" ADD CONSTRAINT "ck_task_status_attempt_count" CHECK ("attempt_count" >= 0);
ALTER TABLE app."task_status" ADD CONSTRAINT "ck_task_status_max_attempts" CHECK ("max_attempts" >= 0);

ALTER TABLE app."company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."company" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_company" ON app."company" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."organization_unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."organization_unit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_organization_unit" ON app."organization_unit" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."position" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."position" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_position" ON app."position" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."employee" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_employee" ON app."employee" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."system_role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."system_role" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_system_role" ON app."system_role" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."data_permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."data_permission" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_data_permission" ON app."data_permission" USING (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true));

ALTER TABLE app."farm_batch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."farm_batch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_farm_batch" ON app."farm_batch" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."house_pen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."house_pen" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_house_pen" ON app."house_pen" USING (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true));

ALTER TABLE app."chick_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."chick_receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_chick_receipt" ON app."chick_receipt" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."feeding_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."feeding_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_feeding_record" ON app."feeding_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."environment_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."environment_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_environment_record" ON app."environment_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."beak_trimming_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."beak_trimming_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_beak_trimming_record" ON app."beak_trimming_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."weighing_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."weighing_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_weighing_record" ON app."weighing_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."transfer_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."transfer_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_transfer_record" ON app."transfer_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."mortality_cull_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."mortality_cull_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_mortality_cull_record" ON app."mortality_cull_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."vaccination_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."vaccination_program" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_vaccination_program" ON app."vaccination_program" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."vaccination_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."vaccination_task" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_vaccination_task" ON app."vaccination_task" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."vaccination_execution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."vaccination_execution" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_vaccination_execution" ON app."vaccination_execution" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."vaccine_requisition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."vaccine_requisition" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_vaccine_requisition" ON app."vaccine_requisition" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."medication_prescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."medication_prescription" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_medication_prescription" ON app."medication_prescription" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."withdrawal_period_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."withdrawal_period_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_withdrawal_period_record" ON app."withdrawal_period_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."quarantine_certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."quarantine_certificate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_quarantine_certificate" ON app."quarantine_certificate" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."purchase_requisition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."purchase_requisition" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_purchase_requisition" ON app."purchase_requisition" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."purchase_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."purchase_order" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_purchase_order" ON app."purchase_order" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_supplier" ON app."supplier" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."goods_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."goods_receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_goods_receipt" ON app."goods_receipt" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."material" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_material" ON app."material" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."inventory_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."inventory_ledger" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_inventory_ledger" ON app."inventory_ledger" USING (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true));

ALTER TABLE app."inbound_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."inbound_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_inbound_record" ON app."inbound_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."outbound_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."outbound_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_outbound_record" ON app."outbound_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."warehouse_location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."warehouse_location" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_warehouse_location" ON app."warehouse_location" USING (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code"::text = current_setting('app.company_id', true));

ALTER TABLE app."stocktake_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."stocktake_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_stocktake_record" ON app."stocktake_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."batch_expiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."batch_expiry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_batch_expiry" ON app."batch_expiry" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."safety_stock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."safety_stock" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_safety_stock" ON app."safety_stock" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_customer" ON app."customer" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."price_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."price_list" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_price_list" ON app."price_list" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."sales_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."sales_order" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_sales_order" ON app."sales_order" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."credit_limit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."credit_limit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_credit_limit" ON app."credit_limit" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."payment_term_exception" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."payment_term_exception" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_payment_term_exception" ON app."payment_term_exception" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."delivery_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."delivery_task" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_delivery_task" ON app."delivery_task" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."vehicle_route" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."vehicle_route" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_vehicle_route" ON app."vehicle_route" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."delivery_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."delivery_receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_delivery_receipt" ON app."delivery_receipt" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."delivery_exception" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."delivery_exception" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_delivery_exception" ON app."delivery_exception" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."receivable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."receivable" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_receivable" ON app."receivable" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."receipt_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."receipt_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_receipt_record" ON app."receipt_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."cash_checkbook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."cash_checkbook" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_cash_checkbook" ON app."cash_checkbook" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."payable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."payable" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_payable" ON app."payable" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."payment_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."payment_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_payment_record" ON app."payment_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."cost_allocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."cost_allocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_cost_allocation" ON app."cost_allocation" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."disbursement_voucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."disbursement_voucher" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_disbursement_voucher" ON app."disbursement_voucher" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."equipment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_equipment" ON app."equipment" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."equipment_check" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."equipment_check" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_equipment_check" ON app."equipment_check" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."maintenance_work_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."maintenance_work_order" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_maintenance_work_order" ON app."maintenance_work_order" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."spare_part" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."spare_part" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_spare_part" ON app."spare_part" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."metric_definition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."metric_definition" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_metric_definition" ON app."metric_definition" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."report_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."report_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_report_record" ON app."report_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."dashboard_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."dashboard_snapshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_dashboard_snapshot" ON app."dashboard_snapshot" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."print_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."print_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_print_template" ON app."print_template" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."print_job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."print_job" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_print_job" ON app."print_job" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."print_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."print_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_print_log" ON app."print_log" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."printer_device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."printer_device" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_printer_device" ON app."printer_device" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_audit_log" ON app."audit_log" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."version_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."version_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_version_history" ON app."version_history" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."traceability_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."traceability_link" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_traceability_link" ON app."traceability_link" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."attachment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_attachment" ON app."attachment" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_notification" ON app."notification" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."term_enum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."term_enum" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_term_enum" ON app."term_enum" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

ALTER TABLE app."offline_sync_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."offline_sync_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation_offline_sync_record" ON app."offline_sync_record" USING (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true)) WITH CHECK (current_setting('app.company_code', true) = '*' OR "company_code" = current_setting('app.company_code', true));

