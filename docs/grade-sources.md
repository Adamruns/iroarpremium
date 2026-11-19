# Grade distribution sources

The extension bundles Clemson Office of Institutional Research section-level percentages. The latest report listed on November 19, 2026 covers Spring 2026. Clemson omits small classes and some sections with highly uniform grades. A missing section means its distribution is unavailable. [Clemson report index](https://open.clemson.edu/gdr/)

| Report | Published rows imported | PDF SHA-256 |
| --- | ---: | --- |
| [Fall 2024](https://open.clemson.edu/gdr/22/) | 3,396 | `1d4e860d2e407ca37233d09b11c2e289f79664a0419fb750cf6e9e730131b4ca` |
| [Spring 2025](https://open.clemson.edu/gdr/24/) | 3,085 | `48c56e0c0c01607bfbbac5f8ecbd4fc068abf51f72c95558e479a90ac658ecde` |
| [Fall 2025](https://open.clemson.edu/gdr/25/) | 3,362 | `8e200e96ca972953ff9f341cd19b24e378755d25b9473490b1716c6816742793` |
| [Spring 2026](https://open.clemson.edu/gdr/26/) | 3,131 | `666437e2ffc21b66d0b2aa20f2b644b7eb0489023c393c52ba727ac2b36891e3` |

To reproduce an import, download the report on the Clemson network or VPN and run `python3 python_tools/import_grade_report.py path/to/report.pdf` with Poppler installed. The importer preserves percentages, section codes, wrapped instructor names, and honors indicators. One Fall 2025 incomplete-grade entry is printed as `####`. Its CSV field is empty and the grade-history dialog shows a dash, which screen readers announce as “unreported.” The dialog also shows a dash for older cells that the PDF printed as `###` or `0% 0%`.

Browse Classes averages the published percentages for the selected course and instructor across reported sections. Each reported row receives equal weight. The semester selector allows inspection of individual sections. Native Banner instructor cells also offer a chronological list of that instructor's published sections, newest first.
