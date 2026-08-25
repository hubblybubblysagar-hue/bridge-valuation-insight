// Real QuickBooks Online report payloads captured verbatim from the sandbox
// sync (sync run 26cc10ef-f688-41c9-9f68-9c82ed4b5adf, 2026-08-25).
// These are regression fixtures: the parser must extract every meaningful
// row, and the Balance Sheet must reconcile ($23,436.29 = $23,436.29).

export const QB_BALANCE_SHEET = {
  Header: {
    Currency: "USD",
    DateMacro: "this calendar year-to-date",
    EndPeriod: "2026-08-25",
    Option: [
      { Name: "AccountingStandard", Value: "GAAP" },
      { Name: "NoReportData", Value: "false" },
    ],
    ReportBasis: "Accrual",
    ReportName: "BalanceSheet",
    StartPeriod: "2026-01-01",
    SummarizeColumnsBy: "Total",
    Time: "2026-08-25T10:12:03-07:00",
  },
  Columns: {
    Column: [
      { ColTitle: "", ColType: "Account", MetaData: [{ Name: "ColKey", Value: "account" }] },
      { ColTitle: "Total", ColType: "Money", MetaData: [{ Name: "ColKey", Value: "total" }] },
    ],
  },
  Rows: {
    Row: [
      {
        Header: { ColData: [{ value: "ASSETS" }, { value: "" }] },
        Rows: {
          Row: [
            {
              Header: { ColData: [{ value: "Current Assets" }, { value: "" }] },
              Rows: {
                Row: [
                  {
                    Header: { ColData: [{ value: "Bank Accounts" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "35", value: "Checking" }, { value: "1201.00" }], type: "Data" },
                        { ColData: [{ id: "36", value: "Savings" }, { value: "800.00" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Bank Accounts" }, { value: "2001.00" }] },
                    group: "BankAccounts",
                    type: "Section",
                  },
                  {
                    Header: { ColData: [{ value: "Accounts Receivable" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "84", value: "Accounts Receivable (A/R)" }, { value: "5281.52" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Accounts Receivable" }, { value: "5281.52" }] },
                    group: "AR",
                    type: "Section",
                  },
                  {
                    Header: { ColData: [{ value: "Other Current Assets" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "81", value: "Inventory Asset" }, { value: "596.25" }], type: "Data" },
                        { ColData: [{ id: "4", value: "Undeposited Funds" }, { value: "2062.52" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Other Current Assets" }, { value: "2658.77" }] },
                    group: "OtherCurrentAssets",
                    type: "Section",
                  },
                ],
              },
              Summary: { ColData: [{ value: "Total Current Assets" }, { value: "9941.29" }] },
              group: "CurrentAssets",
              type: "Section",
            },
            {
              Header: { ColData: [{ value: "Fixed Assets" }, { value: "" }] },
              Rows: {
                Row: [
                  {
                    Header: { ColData: [{ id: "37", value: "Truck" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "38", value: "Original Cost" }, { value: "13495.00" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Truck" }, { value: "13495.00" }] },
                    type: "Section",
                  },
                ],
              },
              Summary: { ColData: [{ value: "Total Fixed Assets" }, { value: "13495.00" }] },
              group: "FixedAssets",
              type: "Section",
            },
          ],
        },
        Summary: { ColData: [{ value: "TOTAL ASSETS" }, { value: "23436.29" }] },
        group: "TotalAssets",
        type: "Section",
      },
      {
        Header: { ColData: [{ value: "LIABILITIES AND EQUITY" }, { value: "" }] },
        Rows: {
          Row: [
            {
              Header: { ColData: [{ value: "Liabilities" }, { value: "" }] },
              Rows: {
                Row: [
                  {
                    Header: { ColData: [{ value: "Current Liabilities" }, { value: "" }] },
                    Rows: {
                      Row: [
                        {
                          Header: { ColData: [{ value: "Accounts Payable" }, { value: "" }] },
                          Rows: {
                            Row: [
                              { ColData: [{ id: "33", value: "Accounts Payable (A/P)" }, { value: "1602.67" }], type: "Data" },
                            ],
                          },
                          Summary: { ColData: [{ value: "Total Accounts Payable" }, { value: "1602.67" }] },
                          group: "AP",
                          type: "Section",
                        },
                        {
                          Header: { ColData: [{ value: "Credit Cards" }, { value: "" }] },
                          Rows: {
                            Row: [
                              { ColData: [{ id: "41", value: "Mastercard" }, { value: "157.72" }], type: "Data" },
                            ],
                          },
                          Summary: { ColData: [{ value: "Total Credit Cards" }, { value: "157.72" }] },
                          group: "CreditCards",
                          type: "Section",
                        },
                        {
                          Header: { ColData: [{ value: "Other Current Liabilities" }, { value: "" }] },
                          Rows: {
                            Row: [
                              { ColData: [{ id: "89", value: "Arizona Dept. of Revenue Payable" }, { value: "0.00" }], type: "Data" },
                              { ColData: [{ id: "90", value: "Board of Equalization Payable" }, { value: "370.94" }], type: "Data" },
                              { ColData: [{ id: "43", value: "Loan Payable" }, { value: "4000.00" }], type: "Data" },
                            ],
                          },
                          Summary: { ColData: [{ value: "Total Other Current Liabilities" }, { value: "4370.94" }] },
                          group: "OtherCurrentLiabilities",
                          type: "Section",
                        },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Current Liabilities" }, { value: "6131.33" }] },
                    group: "CurrentLiabilities",
                    type: "Section",
                  },
                  {
                    Header: { ColData: [{ value: "Long-Term Liabilities" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "44", value: "Notes Payable" }, { value: "25000.00" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Long-Term Liabilities" }, { value: "25000.00" }] },
                    group: "LongTermLiabilities",
                    type: "Section",
                  },
                ],
              },
              Summary: { ColData: [{ value: "Total Liabilities" }, { value: "31131.33" }] },
              group: "Liabilities",
              type: "Section",
            },
            {
              Header: { ColData: [{ value: "Equity" }, { value: "" }] },
              Rows: {
                Row: [
                  { ColData: [{ id: "34", value: "Opening Balance Equity" }, { value: "-9337.50" }], type: "Data" },
                  { ColData: [{ id: "2", value: "Retained Earnings" }, { value: "1642.46" }], type: "Data" },
                  { ColData: [{ value: "Net Income" }, { value: "" }], group: "NetIncome", type: "Data" },
                ],
              },
              Summary: { ColData: [{ value: "Total Equity" }, { value: "-7695.04" }] },
              group: "Equity",
              type: "Section",
            },
          ],
        },
        Summary: { ColData: [{ value: "TOTAL LIABILITIES AND EQUITY" }, { value: "23436.29" }] },
        group: "TotalLiabilitiesAndEquity",
        type: "Section",
      },
    ],
  },
};

export const QB_PROFIT_AND_LOSS = {
  Header: {
    Currency: "USD",
    EndPeriod: "2025-12-31",
    Option: [
      { Name: "AccountingStandard", Value: "GAAP" },
      { Name: "NoReportData", Value: "false" },
    ],
    ReportBasis: "Accrual",
    ReportName: "ProfitAndLoss",
    StartPeriod: "2025-01-01",
    SummarizeColumnsBy: "Total",
    Time: "2026-08-25T10:12:01-07:00",
  },
  Columns: {
    Column: [
      { ColTitle: "", ColType: "Account", MetaData: [{ Name: "ColKey", Value: "account" }] },
      { ColTitle: "Total", ColType: "Money", MetaData: [{ Name: "ColKey", Value: "total" }] },
    ],
  },
  Rows: {
    Row: [
      {
        Header: { ColData: [{ value: "Income" }, { value: "" }] },
        Rows: {
          Row: [
            { ColData: [{ id: "82", value: "Design income" }, { value: "2250.00" }], type: "Data" },
            { ColData: [{ id: "86", value: "Discounts given" }, { value: "-89.50" }], type: "Data" },
            {
              Header: { ColData: [{ id: "45", value: "Landscaping Services" }, { value: "1477.50" }] },
              Rows: {
                Row: [
                  {
                    Header: { ColData: [{ id: "46", value: "Job Materials" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "48", value: "Fountains and Garden Lighting" }, { value: "2246.50" }], type: "Data" },
                        { ColData: [{ id: "49", value: "Plants and Soil" }, { value: "2351.97" }], type: "Data" },
                        { ColData: [{ id: "50", value: "Sprinklers and Drip Systems" }, { value: "138.00" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Job Materials" }, { value: "4736.47" }] },
                    type: "Section",
                  },
                  {
                    Header: { ColData: [{ id: "51", value: "Labor" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "52", value: "Installation" }, { value: "250.00" }], type: "Data" },
                        { ColData: [{ id: "53", value: "Maintenance and Repair" }, { value: "50.00" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Labor" }, { value: "300.00" }] },
                    type: "Section",
                  },
                ],
              },
              Summary: { ColData: [{ value: "Total Landscaping Services" }, { value: "6513.97" }] },
              type: "Section",
            },
            { ColData: [{ id: "54", value: "Pest Control Services" }, { value: "110.00" }], type: "Data" },
            { ColData: [{ id: "79", value: "Sales of Product Income" }, { value: "912.75" }], type: "Data" },
            { ColData: [{ id: "1", value: "Services" }, { value: "503.55" }], type: "Data" },
          ],
        },
        Summary: { ColData: [{ value: "Total Income" }, { value: "10200.77" }] },
        group: "Income",
        type: "Section",
      },
      {
        Header: { ColData: [{ value: "Cost of Goods Sold" }, { value: "" }] },
        Rows: {
          Row: [
            { ColData: [{ id: "80", value: "Cost of Goods Sold" }, { value: "405.00" }], type: "Data" },
          ],
        },
        Summary: { ColData: [{ value: "Total Cost of Goods Sold" }, { value: "405.00" }] },
        group: "COGS",
        type: "Section",
      },
      {
        Summary: { ColData: [{ value: "Gross Profit" }, { value: "9795.77" }] },
        group: "GrossProfit",
        type: "Section",
      },
      {
        Header: { ColData: [{ value: "Expenses" }, { value: "" }] },
        Rows: {
          Row: [
            { ColData: [{ id: "7", value: "Advertising" }, { value: "74.86" }], type: "Data" },
            {
              Header: { ColData: [{ id: "55", value: "Automobile" }, { value: "113.96" }] },
              Rows: {
                Row: [
                  { ColData: [{ id: "56", value: "Fuel" }, { value: "349.41" }], type: "Data" },
                ],
              },
              Summary: { ColData: [{ value: "Total Automobile" }, { value: "463.37" }] },
              type: "Section",
            },
            { ColData: [{ id: "29", value: "Equipment Rental" }, { value: "112.00" }], type: "Data" },
            { ColData: [{ id: "11", value: "Insurance" }, { value: "241.23" }], type: "Data" },
            {
              Header: { ColData: [{ id: "58", value: "Job Expenses" }, { value: "155.07" }] },
              Rows: {
                Row: [
                  {
                    Header: { ColData: [{ id: "63", value: "Job Materials" }, { value: "" }] },
                    Rows: {
                      Row: [
                        { ColData: [{ id: "64", value: "Decks and Patios" }, { value: "234.04" }], type: "Data" },
                        { ColData: [{ id: "66", value: "Plants and Soil" }, { value: "353.12" }], type: "Data" },
                        { ColData: [{ id: "67", value: "Sprinklers and Drip Systems" }, { value: "215.66" }], type: "Data" },
                      ],
                    },
                    Summary: { ColData: [{ value: "Total Job Materials" }, { value: "802.82" }] },
                    type: "Section",
                  },
                ],
              },
              Summary: { ColData: [{ value: "Total Job Expenses" }, { value: "957.89" }] },
              type: "Section",
            },
            {
              Header: { ColData: [{ id: "12", value: "Legal & Professional Fees" }, { value: "75.00" }] },
              Rows: {
                Row: [
                  { ColData: [{ id: "69", value: "Accounting" }, { value: "640.00" }], type: "Data" },
                  { ColData: [{ id: "70", value: "Bookkeeper" }, { value: "55.00" }], type: "Data" },
                  { ColData: [{ id: "71", value: "Lawyer" }, { value: "400.00" }], type: "Data" },
                ],
              },
              Summary: { ColData: [{ value: "Total Legal & Professional Fees" }, { value: "1170.00" }] },
              type: "Section",
            },
            {
              Header: { ColData: [{ id: "72", value: "Maintenance and Repair" }, { value: "185.00" }] },
              Rows: {
                Row: [
                  { ColData: [{ id: "75", value: "Equipment Repairs" }, { value: "755.00" }], type: "Data" },
                ],
              },
              Summary: { ColData: [{ value: "Total Maintenance and Repair" }, { value: "940.00" }] },
              type: "Section",
            },
            { ColData: [{ id: "13", value: "Meals and Entertainment" }, { value: "28.49" }], type: "Data" },
            { ColData: [{ id: "15", value: "Office Expenses" }, { value: "18.08" }], type: "Data" },
            { ColData: [{ id: "17", value: "Rent or Lease" }, { value: "900.00" }], type: "Data" },
            {
              Header: { ColData: [{ id: "24", value: "Utilities" }, { value: "" }] },
              Rows: {
                Row: [
                  { ColData: [{ id: "76", value: "Gas and Electric" }, { value: "200.53" }], type: "Data" },
                  { ColData: [{ id: "77", value: "Telephone" }, { value: "130.86" }], type: "Data" },
                ],
              },
              Summary: { ColData: [{ value: "Total Utilities" }, { value: "331.39" }] },
              type: "Section",
            },
          ],
        },
        Summary: { ColData: [{ value: "Total Expenses" }, { value: "5237.31" }] },
        group: "Expenses",
        type: "Section",
      },
      {
        Summary: { ColData: [{ value: "Net Operating Income" }, { value: "4558.46" }] },
        group: "NetOperatingIncome",
        type: "Section",
      },
      {
        Header: { ColData: [{ value: "Other Expenses" }, { value: "" }] },
        Rows: {
          Row: [
            { ColData: [{ id: "14", value: "Miscellaneous" }, { value: "2916.00" }], type: "Data" },
          ],
        },
        Summary: { ColData: [{ value: "Total Other Expenses" }, { value: "2916.00" }] },
        group: "OtherExpenses",
        type: "Section",
      },
      {
        Summary: { ColData: [{ value: "Net Other Income" }, { value: "-2916.00" }] },
        group: "NetOtherIncome",
        type: "Section",
      },
      {
        Summary: { ColData: [{ value: "Net Income" }, { value: "1642.46" }] },
        group: "NetIncome",
        type: "Section",
      },
    ],
  },
};
