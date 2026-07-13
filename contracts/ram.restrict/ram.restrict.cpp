#include <eosio/eosio.hpp>
using namespace eosio;

CONTRACT ramtester : public contract {
   public:
      using contract::contract;

      TABLE row {
         uint64_t id;
         uint64_t sec;
         std::vector<uint8_t> data;
         uint64_t primary_key() const { return id; }
         uint64_t by_sec() const { return sec; }
      };
      typedef multi_index<"rows"_n, row,
         indexed_by<"bysec"_n, const_mem_fun<row, uint64_t, &row::by_sec>>> rows_t;

      ACTION store(name payer, uint64_t id, uint32_t size) {
         rows_t rows(get_self(), get_self().value);
         rows.emplace(payer, [&](auto& r) {
            r.id = id;
            r.sec = id;
            r.data.assign(size, 0);
         });
      }

      ACTION modify(name payer, uint64_t id, uint32_t size) {
         rows_t rows(get_self(), get_self().value);
         auto& r = rows.get(id, "row not found");
         rows.modify(r, payer, [&](auto& row) {
            row.data.assign(size, 0);
         });
      }

      ACTION erase(uint64_t id) {
         rows_t rows(get_self(), get_self().value);
         auto& r = rows.get(id, "row not found");
         rows.erase(r);
      }

      ACTION growshrink(uint64_t id, uint32_t grow_to, uint32_t final_size) {
         rows_t rows(get_self(), get_self().value);
         auto& r = rows.get(id, "row not found");
         rows.modify(r, same_payer, [&](auto& row) {
            row.data.assign(grow_to, 0);
         });
         rows.modify(r, same_payer, [&](auto& row) {
            row.data.assign(final_size, 0);
         });
      }

      ACTION notify(name to, name payer, uint64_t id, uint32_t size) {
         require_recipient(to);
      }

      [[eosio::on_notify("*::notify")]]
      void onnotify(name to, name payer, uint64_t id, uint32_t size) {
         rows_t rows(get_self(), get_self().value);
         rows.emplace(payer, [&](auto& r) {
            r.id = id;
            r.sec = id;
            r.data.assign(size, 0);
         });
      }
};
