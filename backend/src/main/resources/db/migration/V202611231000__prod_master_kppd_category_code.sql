-- 개발용 시드 상품마스터 KPPD-2026-0001~0080: 엑셀의 한글 카테고리 이름(ICT/저장/HDD)을 trd_ctgr_master 코드로 바꾼다.
-- 이름 그대로면 카테고리 코드('-' 연결)가 13자가 되어 등록 폼의 12자 제한에 걸리고 카테고리 마스터와도 연결되지 않았다.
-- 보증년수는 폼 규칙(3~60의 3 배수)에 맞춰 5 → 6. 해당 행이 없는 DB(운영)에서는 아무 일도 하지 않는다.
update trd_prod_master set major_category = 'E05', middle_category = 'F20', minor_category = 'G065'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '저장' and minor_category = 'HDD';
update trd_prod_master set major_category = 'E03', middle_category = 'F12', minor_category = 'G037'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '저장' and minor_category = '스토리지부품';
update trd_prod_master set major_category = 'E05', middle_category = 'F19', minor_category = 'G061'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '저장' and minor_category = '메모리';
update trd_prod_master set major_category = 'E02', middle_category = 'F08', minor_category = 'G027'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '컴퓨팅' and minor_category = '서버부품';
update trd_prod_master set major_category = 'E04', middle_category = 'F13', minor_category = 'G042'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '네트웍' and minor_category = '스위치';
update trd_prod_master set major_category = 'E04', middle_category = 'F16', minor_category = 'G054'
 where prod_id like 'KPPD-2026-%' and major_category = 'ICT' and middle_category = '네트웍' and minor_category = '패치코드';
update trd_prod_master set prod_useful_life = 6 where prod_id like 'KPPD-2026-%' and prod_useful_life = 5;
