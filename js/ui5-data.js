/** 수업 필기를 바탕으로 재구성한 UI5 학습 문서. */
(function () {
  const paragraph = (...paragraphs) => ({ type: "text", paragraphs });
  const code = (label, code) => ({ type: "code", label, code });
  const table = (headers, rows) => ({ type: "table", headers, rows });
  const section = (title, ...blocks) => ({ title, blocks });
  const exercise = (action, detail) => ({
    type: "practice", title: "직접 확인하기", steps: [{ step: "1", action, detail }]
  });
  const lessons = [
    {
      id: "ui5-structure", title: "프로젝트 구조와 MVC", aliases: ["MVC", "sap.ui.define"],
      summary: "View는 화면, Controller는 이벤트 처리, Model은 데이터와 접근 방법을 담당합니다.",
      sections: [
        section("파일을 읽는 순서", table(["파일", "역할"], [
          ["index.html", "독립 실행 시 UI5 부트스트랩과 앱 시작점"],
          ["Component.js", "앱 컴포넌트 초기화"],
          ["manifest.json", "모델·데이터 소스·라우팅 설정"],
          ["view/*.view.xml", "컨트롤 배치와 바인딩"],
          ["controller/*.controller.js", "초기화와 사용자 이벤트 처리"],
          ["model", "모델 생성 및 포매터 등 재사용 코드"],
          ["i18n", "언어별 표시 문구"],
          ["package.json", "의존성과 실행 스크립트"]
        ])),
        section("모듈과 화면 연결", paragraph("의존성 경로 sap/m/MessageToast와 클래스 이름 sap.m.MessageToast의 표기를 구분합니다. 의존성 배열과 콜백 인수는 같은 순서로 맞춥니다. 아래 demo는 실제 프로젝트 namespace로 바꾸세요."),
          code("Main.controller.js", `sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";
  return Controller.extend("demo.controller.Main", {
    onPress: function () {
      MessageToast.show("버튼을 눌렀습니다.");
    }
  });
});`),
          code("Main.view.xml", `<mvc:View controllerName="demo.controller.Main"
  xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m">
  <Page title="첫 UI5 화면">
    <content><Button text="확인" press=".onPress" /></content>
  </Page>
</mvc:View>`), exercise("버튼을 눌러 메시지를 표시하세요.", "controllerName과 Controller.extend의 이름이 일치하는지 확인합니다."))
      ]
    },
    {
      id: "ui5-model", title: "JSONModel과 모델 등록", aliases: ["JSONModel"],
      summary: "객체를 모델에 넣고 View에 등록하면 컨트롤에서 경로로 데이터를 읽을 수 있습니다.",
      sections: [
        section("생성 → 등록 → 사용", paragraph("Model은 브라우저 메모리에도 존재합니다. 화면 상태와 작은 실습 데이터에는 JSONModel을 사용합니다. JSONModel을 sap/ui/model/json/JSONModel에서 가져온 뒤 onInit에 다음 코드를 넣습니다."),
          code("Controller의 onInit 내부", `const oModel = new JSONModel({
  customer: { name: "학습 고객", city: "서울" },
  products: [
    { id: 1, name: "키보드", price: 45000 },
    { id: 12, name: "마우스", price: 22000 }
  ]
});
this.getView().setModel(oModel, "shop");`),
          code("XML View 내부", `<Input value="{shop>/customer/name}" />
<Text text="{shop>/customer/name}" />`)),
        section("이름과 변경 방향", paragraph("shop은 모델 등록 시 정한 이름입니다. 바인딩의 shop>, getModel(\"shop\"), getBindingContext(\"shop\")를 일관되게 맞춥니다. 기본 모델은 이름을 생략합니다.", "JSONModel의 기본 바인딩 모드는 TwoWay입니다. Input 변경을 확정하면 같은 경로를 읽는 Text에도 반영됩니다. 프로그램에서 모델 값을 바꿀 때는 setProperty를 사용합니다."),
          code("Controller 내부", `this.getView().getModel("shop")
  .setProperty("/customer/city", "부산");`),
          exercise("Input의 이름을 바꾸고 Enter를 누르세요.", "Text가 함께 바뀌는지 확인합니다."))
      ]
    },
    {
      id: "ui5-binding", title: "세 가지 바인딩", aliases: ["Property Binding", "Aggregation Binding", "Element Binding", "Binding Context"],
      summary: "속성 하나, 반복 목록, 특정 객체의 문맥을 연결하는 바인딩을 구분합니다.",
      sections: [
        section("대상에 따른 구분", table(["종류", "연결 대상", "예시"], [
          ["Property Binding", "컨트롤 속성", "Text의 text, Input의 value"],
          ["Aggregation Binding", "반복할 자식 컨트롤", "List의 items, Table의 rows"],
          ["Element Binding", "객체 문맥", "선택한 고객의 상세 영역"]
        ])),
        section("절대경로와 상대경로", paragraph("앞에 /가 있으면 모델 루트부터 찾습니다. 상대경로는 부모 또는 반복 행의 Binding Context를 기준으로 찾습니다. 각 상품 행은 해당 상품 객체를 문맥으로 가지므로 name을 상대경로로 읽습니다. [[ui5-model|JSONModel 예제]]의 데이터를 사용합니다."),
          code("XML View 내부", `<List items="{shop>/products}">
  <StandardListItem title="{shop>name}" description="{shop>price}" />
</List>
<VBox id="customerDetail">
  <Text text="{shop>name}" />
  <Text text="{shop>city}" />
</VBox>`), code("Controller 내부", `this.byId("customerDetail").bindElement({
  path: "/customer",
  model: "shop"
});`), exercise("customerDetail의 bindElement를 잠시 제거하세요.", "상대경로의 기준 문맥이 사라지면 화면이 어떻게 달라지는지 확인합니다."))
      ]
    },
    {
      id: "ui5-events", title: "이벤트와 선택한 행", aliases: [],
      summary: "선택한 컨트롤의 문맥에서 키와 경로를 읽고 상세 화면을 연결합니다.",
      sections: [
        section("이벤트 파라미터", table(["컨트롤·이벤트", "선택한 대상"], [
          ["sap.m.List / sap.m.Table · selectionChange", "getParameter(\"listItem\")"],
          ["sap.m.ComboBox · selectionChange", "getParameter(\"selectedItem\")"],
          ["Button · press", "getSource()"]
        ])),
        section("목록에서 상세로", code("XML View 내부", `<List id="products" items="{shop>/products}" mode="SingleSelectMaster"
  selectionChange=".onProductSelect">
  <StandardListItem title="{shop>name}" />
</List>
<VBox id="productDetail">
  <Text text="{shop>name}" />
  <ObjectNumber number="{shop>price}" unit="KRW" />
</VBox>`), code("Controller 메서드", `onProductSelect: function (oEvent) {
  const oItem = oEvent.getParameter("listItem");
  const oContext = oItem && oItem.getBindingContext("shop");
  if (!oContext) { return; }
  this.byId("productDetail").bindElement({
    path: oContext.getPath(),
    model: "shop"
  });
}`), paragraph("키가 필요하면 oContext.getProperty(\"id\")로 읽습니다. 경로 문자열의 마지막 글자를 잘라 ID로 사용하면 두 자리 이상의 ID에서 잘못된 값을 얻습니다."),
          exercise("두 상품을 번갈아 선택하세요.", "상품명과 가격이 함께 바뀌는지 확인합니다."))
      ]
    },
    {
      id: "ui5-filter", title: "필터와 정렬", aliases: ["Filter", "Sorter"],
      summary: "목록의 Binding에 검색 조건과 정렬 기준을 적용합니다.",
      sections: [
        section("검색 적용", paragraph("Filter와 FilterOperator를 각각 sap/ui/model/Filter와 sap/ui/model/FilterOperator에서 가져옵니다. 아래는 [[ui5-events|상품 목록]]에 적용하는 예제입니다."),
          code("XML View 내부", `<SearchField search=".onSearch" />`), code("Controller 메서드", `onSearch: function (oEvent) {
  const sQuery = (oEvent.getParameter("query") || "").trim();
  const aFilters = sQuery
    ? [new Filter("name", FilterOperator.Contains, sQuery)]
    : [];
  this.byId("products").getBinding("items")
    .filter(aFilters, "Application");
}`), paragraph("복합 조건은 new Filter({ filters: [...], and: true })로 묶습니다. OR 조건은 and: false로 설정합니다. 숫자 키는 서비스 자료형에 맞게 변환합니다.")),
        section("정렬과 초기화", paragraph("Sorter는 sap/ui/model/Sorter에서 가져옵니다. 두 번째 인수 true는 내림차순, false는 오름차순입니다. sap.m.Table은 items, sap.ui.table.Table은 rows 바인딩을 사용합니다."),
          code("Controller 내부", `const oBinding = this.byId("products").getBinding("items");
oBinding.sort(new Sorter("price", true));

// 검색과 정렬 초기화
oBinding.filter([], "Application");
oBinding.sort(null);`), exercise("이름 검색 후 가격 내림차순으로 정렬하세요.", "검색 결과 없음과 빈 검색어로 전체 목록 복구도 확인합니다."))
      ]
    },
    {
      id: "ui5-format", title: "숫자·날짜 포매팅", aliases: ["formatOptions", "formatter"],
      summary: "원본 데이터와 표시 형식을 구분하고 바인딩 타입으로 형식을 지정합니다.",
      sections: [
        section("소수점 두 자리", code("상품 상세 영역의 XML", `<ObjectNumber number="{
  path: 'shop>price',
  type: 'sap.ui.model.type.Float',
  formatOptions: { minFractionDigits: 2, maxFractionDigits: 2 }
}" unit="KRW" />`), paragraph("설정 이름은 formatOptions입니다. [[ui5-events|선택한 상품 문맥]] 안에서 price를 읽습니다. 표시 포매팅만으로 환율 계산이 적용되지는 않습니다.")),
        section("날짜 패턴", paragraph("문자열 날짜의 입력 패턴과 출력 패턴을 구분합니다. yyyy-MM-dd의 MM은 월, mm은 분입니다. Date 객체나 OData 날짜 타입을 사용하는 경우에는 해당 자료형에 맞게 바인딩합니다."),
          code("문자열 날짜 예제", `<Text text="{
  path: 'shop>/orderDate',
  type: 'sap.ui.model.type.Date',
  formatOptions: {
    source: { pattern: 'yyyy-MM-dd' },
    pattern: 'yyyy.MM.dd'
  }
}" />`), paragraph("예제 사용 전에 shop 모델에 orderDate를 '2026-10-28' 같은 문자열로 추가합니다. B를 Business Class로 바꾸는 업무 규칙은 formatter 함수로 분리할 수 있습니다."),
          exercise("price에 12.3을 넣어 12.30으로 표시하세요.", "날짜도 원본 자료형과 표시 결과를 함께 확인합니다."))
      ]
    },
    {
      id: "ui5-dialog", title: "Fragment와 Dialog", aliases: ["Fragment", "Dialog"],
      summary: "재사용할 화면 조각을 Fragment로 분리하고 필요할 때 Dialog로 표시합니다.",
      sections: [
        section("화면 조각 정의", code("view/ProductDialog.fragment.xml", `<core:FragmentDefinition xmlns="sap.m" xmlns:core="sap.ui.core">
  <Dialog id="productDialog" title="상품 상세">
    <content><Text text="{shop>name}" /></content>
    <endButton><Button text="닫기" press=".onCloseProduct" /></endButton>
  </Dialog>
</core:FragmentDefinition>`), paragraph("Fragment에는 독립적인 Controller가 없습니다. Fragment.load에 현재 Controller를 전달해 이벤트를 연결합니다.")),
        section("생성 후 재사용", paragraph("Fragment를 sap/ui/core/Fragment에서 가져옵니다. 아래 메서드는 상품 행 안의 버튼 press에 연결합니다. addDependent로 View의 모델과 생명주기를 연결합니다."),
          code("Controller 메서드", `onOpenProduct: async function (oEvent) {
  const oContext = oEvent.getSource().getBindingContext("shop");
  if (!oContext) { return; }
  if (!this._productDialogPromise) {
    this._productDialogPromise = Fragment.load({
      id: this.getView().getId(),
      name: "demo.view.ProductDialog",
      controller: this
    }).then(function (oDialog) {
      this.getView().addDependent(oDialog);
      return oDialog;
    }.bind(this)).catch(function (oError) {
      this._productDialogPromise = null;
      throw oError;
    }.bind(this));
  }
  const oDialog = await this._productDialogPromise;
  oDialog.setBindingContext(oContext, "shop");
  oDialog.open();
},
onCloseProduct: function () {
  this.byId("productDialog").close();
}`), exercise("다른 상품으로 다이얼로그를 다시 여세요.", "이전 상품의 데이터가 남지 않는지 확인합니다. 앱에서는 로딩 실패 안내도 추가합니다."))
      ]
    },
    {
      id: "ui5-i18n", title: "다국어 처리", aliases: ["i18n", "ResourceModel"],
      summary: "표시 문구를 ResourceModel에 모아 언어별로 관리합니다.",
      sections: [
        section("리소스와 모델 등록", code("i18n/i18n.properties", "appTitle=Order Search\nsearch=Search"),
          code("i18n/i18n_ko.properties", "appTitle=주문 조회\nsearch=검색"),
          code("manifest.json의 sap.ui5.models 내부", `"i18n": {
  "type": "sap.ui.model.resource.ResourceModel",
  "settings": {
    "bundleName": "demo.i18n.i18n",
    "supportedLocales": ["", "ko"],
    "fallbackLocale": ""
  }
}`), paragraph("기본 파일에는 영어 문구를 넣습니다. demo는 실제 앱 namespace로 바꿉니다. 설정 이름은 supportedLocales와 fallbackLocale입니다.")),
        section("화면에서 사용", code("XML View 내부", `<Button text="{i18n>search}" press=".onSearch" />`),
          paragraph("URL에 sap-ui-language=ko 또는 sap-ui-language=en을 지정해 확인합니다. 첫 쿼리는 ?로, 기존 쿼리 뒤에는 &amp;로 연결합니다."),
          exercise("한국어와 영어로 화면을 확인하세요.", "문구 길이가 바뀌어도 버튼과 레이아웃이 잘리지 않아야 합니다."))
      ]
    },
    {
      id: "ui5-odata", title: "OData 서비스 읽기", aliases: ["OData", "EntitySet"],
      summary: "엔티티, 키, 관계를 이해하고 화면에 필요한 조회를 구성합니다. 이 문서는 V2 기준입니다.",
      sections: [
        section("주소를 읽는 단위", table(["경로", "의미"], [
          ["/Orders", "주문 EntitySet"], ["/Orders(10248)", "키가 10248인 주문"],
          ["/Orders(10248)/OrderDate", "주문의 날짜 속성"], ["/$metadata", "엔티티·키·자료형·관계 정의"]
        ])),
        section("조회 옵션", table(["옵션", "목적", "예시"], [
          ["$filter", "조회 조건", "CustomerID eq 'ALFKI'"],
          ["$select", "가져올 속성", "OrderID,OrderDate"],
          ["$orderby", "정렬", "OrderDate desc"],
          ["$top / $skip", "개수와 건너뛸 개수", "$top=20&amp;$skip=20"],
          ["$expand", "연관 엔티티 포함", "Order_Details"]
        ])),
        section("V2 모델의 변경 처리", paragraph("OData V2 모델은 속성 변경에 대한 TwoWay 바인딩을 지원합니다. 기본 모드는 OneWay이므로 필요에 따라 설정합니다. 화면에서 값을 바꾸는 동작과 서버에 변경을 제출하는 동작을 구분합니다.", "읽은 객체를 직접 수정하면 모델 변경 추적과 화면 갱신이 맞지 않을 수 있습니다. 모델 API와 바인딩을 통해 변경합니다.", '<a href="https://help.sap.com/docs/SAPUI5/7d0efeaa9ccd4731afb386284cfdc3a9/6c47b2b39db9404582994070ec3d57a2.html" target="_blank" rel="noopener noreferrer">SAP 공식 OData V2 모델 문서</a>'),
          exercise("사용할 서비스의 $metadata를 확인하세요.", "Orders의 키 자료형과 상세 관계명을 확인한 뒤 바인딩 경로를 정합니다."))
      ]
    },
    {
      id: "ui5-orders", title: "주문 조회 종합 실습", aliases: [],
      summary: "검색 → 주문 선택 → 주문상세 → 상품·공급업체 탐색 흐름으로 수업 내용을 연결합니다.",
      sections: [
        section("화면과 데이터 관계", paragraph("주문 조회 설계 메모와 발표 대본을 바탕으로 구성했습니다. 실제 관계명은 사용하는 서비스의 $metadata에서 확인합니다."), table(["영역", "데이터", "구현할 기능"], [
          ["검색 조건", "기준일·주문 번호·고객", "주문 목록 필터"],
          ["주문 목록", "Orders", "주문일·납기요청일·출하일 표시"],
          ["주문 상세", "Order_Details", "상품·단가·수량·할인율 표시"],
          ["상품 상세", "Products", "상품명과 공급업체 조회"],
          ["배송 정보", "선택한 주문의 배송 관계", "배송업체와 연락처 표시"]
        ])),
        section("구현 순서", { type: "practice", title: "주문 조회 화면 만들기", steps: [
          { step: "1", action: "주문 목록부터 표시합니다.", detail: "주문 번호와 날짜로 서비스 연결과 바인딩 경로를 검증합니다." },
          { step: "2", action: "검색 조건을 추가합니다.", detail: "기준일 이전 주문 또는 당일 주문 중 조회 의미를 정하고 자료형을 맞춥니다." },
          { step: "3", action: "선택한 주문의 상세를 연결합니다.", detail: "선택 행의 문맥과 Navigation Property로 상품 목록을 조회합니다." },
          { step: "4", action: "정렬과 초기화를 추가합니다.", detail: "재검색 시 이전 선택과 상세도 초기화합니다." },
          { step: "5", action: "포매팅과 다국어를 적용합니다.", detail: "금액·날짜 표시, 긴 문구, 작은 화면을 점검합니다." }
        ] }),
        section("합계와 예외 상황", paragraph("주문상세 금액은 단가 × 수량 × (1 − 할인율)로 계산할 수 있습니다. Discount가 0~1 비율인지 데이터 정의를 확인하고 통화와 반올림 규칙도 정합니다.", "발표의 고정 환율은 시연용 설정입니다. 실제 환산 기능은 환율 기준일, 출처, 조회 실패 처리까지 정의해야 합니다."), table(["상황", "확인할 결과"], [
          ["검색 결과 없음", "빈 목록 안내와 이전 상세 제거"],
          ["출하일 없음", "미출하 표시와 날짜 오류 방지"],
          ["두 자리 이상 상품 ID", "문맥에서 키를 읽어 정확히 연결"],
          ["빠르게 주문 변경", "최종 선택한 주문의 상세 표시"],
          ["서비스 오류", "오류 안내와 재시도"],
          ["이미지 없음", "대체 표시로 레이아웃 유지"]
        ]))
      ]
    },
    {
      id: "ui5-troubleshooting", title: "바인딩 오류 점검표", categoryId: "ui5-concept", aliases: [],
      summary: "화면이 비거나 이벤트가 동작하지 않을 때 연결 지점을 순서대로 확인합니다.",
      sections: [section("증상별 점검", table(["증상", "확인할 곳"], [
        ["모듈 로드 실패", "sap/ui/... 경로와 콜백 인수 순서"],
        ["이벤트 함수 없음", "controllerName, 메서드 이름과 대소문자"],
        ["Text가 비어 있음", "모델 등록·이름·경로·부모 문맥"],
        ["getBinding 결과 없음", "컨트롤 ID, items/rows와 aggregation 바인딩"],
        ["선택 데이터 없음", "이벤트 종류, listItem/selectedItem, 모델 이름"],
        ["Fragment 중복 ID", "반복 생성 여부와 ID 접두사"],
        ["날짜 표시 오류", "원본 자료형과 MM/mm 패턴"],
        ["OData 요청 실패", "Network 상태 코드·서비스 경로·응답 내용"]
      ])), section("작게 나눠 확인", paragraph("먼저 정적인 Text가 보이는지 확인하고 모델 속성 하나를 연결합니다. 그다음 목록 반복, 선택 이벤트, 상세 바인딩을 차례로 추가하면 오류가 생긴 단계를 찾기 쉽습니다.", "브라우저 Console과 Network를 함께 확인합니다. 실제 고객 정보가 있는 모델 전체를 출력하는 대신 필요한 경로와 필드만 확인합니다."))]
    },
    {
      id: "ui5-controls", title: "컨트롤 · API 빠른 참조", categoryId: "ui5-control", aliases: ["sap.m.Table", "sap.ui.table.Table", "ComboBox", "ObjectNumber"],
      summary: "수업에서 사용한 컨트롤의 바인딩 지점과 이벤트를 정리했습니다.",
      sections: [section("화면 컨트롤", table(["컨트롤", "속성·aggregation", "이벤트 또는 용도"], [
        ["Text", "text", "문구 표시"], ["Input", "value", "change / liveChange"],
        ["Button", "text, enabled", "press"], ["ComboBox", "items, selectedKey", "selectionChange"],
        ["DatePicker", "dateValue / value", "change"], ["sap.m.Table", "columns, items", "selectionChange"],
        ["sap.ui.table.Table", "columns, rows", "rowSelectionChange"], ["ObjectNumber", "number, unit", "숫자와 단위"],
        ["Carousel", "pages", "pageChanged"], ["Dialog", "content, endButton", "상세 팝업"],
        ["SimpleForm", "content", "Label과 입력 컨트롤 배치"]
      ])), section("자주 쓰는 API", table(["API", "의미"], [
        ["this.getView()", "현재 Controller의 View"], ["this.byId(\"id\")", "View 범위에서 컨트롤 조회"],
        ["getModel(\"shop\")", "이름 있는 모델 조회"], ["getBindingContext(\"shop\")", "모델 문맥 조회"],
        ["getProperty(\"id\")", "문맥의 속성 읽기"], ["getBinding(\"items\")", "목록 바인딩 조회"],
        ["bindElement({path, model})", "객체 문맥 연결"], ["setProperty(\"/path\", value)", "모델 값 변경"]
      ])), section("테이블 문법 구분", paragraph("sap.m.Table은 ColumnListItem의 cells를 구성하고 items에 바인딩합니다. sap.ui.table.Table은 각 Column의 template을 구성하고 rows에 바인딩합니다."))]
    }
  ];

  const repository = "https://github.com/ehmaker0219/SAPUI5-PRACTICE/tree/479e061c66a578233fb5d3d2855ed331e60d8124/";
  const source = (project, detail) => section("실습 원본과 읽을 지점", paragraph(
    detail,
    `<a href="${repository}${project}" target="_blank" rel="noopener noreferrer">SAPUI5-PRACTICE / ${project}</a>`
  ));
  const extend = (id, ...sections) => lessons.find(lesson => lesson.id === id).sections.push(...sections);

  extend("ui5-structure",
    section("부트스트랩에서 XML View까지", paragraph(
      "10월 22일 PPT의 6·12·21~27쪽은 부트스트랩, 모듈, XML View의 연결을 설명합니다. 부트스트랩이 UI5 런타임을 준비하고 시작 모듈이 View를 생성한 뒤 HTML의 content 영역에 배치합니다.",
      "resourceRoots는 namespace와 실제 폴더를 연결합니다. viewName에는 .view.xml 접미사를 붙이지 않습니다. XMLView.create는 Promise를 반환하므로 생성 완료 뒤 placeAt을 호출합니다."
    ), code("독립 XML View를 실행하는 시작 모듈", `sap.ui.define(["sap/ui/core/mvc/XMLView"], function (XMLView) {
  "use strict";
  XMLView.create({ viewName: "demo.view.Main" }).then(function (oView) {
    oView.placeAt("content");
  });
});`), paragraph("HTML에 id가 content인 요소가 있어야 합니다. Component 기반 프로젝트에서는 기존 Component·라우팅 시작 흐름을 확인한 뒤 실행 방식을 정합니다. 같은 View를 두 시작점에서 생성하면 화면이 중복될 수 있습니다.")),
    source("zproject7_view", "webapp의 시작 모듈과 view 폴더를 함께 읽습니다. PPT의 namespace → View 생성 → 화면 배치 순서와 대조하세요.")
  );
  extend("ui5-model",
    section("외부 JSON과 비동기 로딩", paragraph("zproject19_model2는 JSONModel을 생성한 뒤 loadData로 파일을 읽습니다. 요청이 끝나기 전에 getData로 값을 읽으면 아직 데이터가 없을 수 있습니다. UI에는 먼저 모델을 등록하고 바인딩을 연결할 수 있습니다."),
      code("onInit 내부 · JSONModel 의존성 필요", `const oModel = new JSONModel();
this.getView().setModel(oModel, "shop");
oModel.attachRequestFailed(function () {
  // 앱의 오류 메시지 영역에 로딩 실패를 표시합니다.
});
oModel.loadData(sap.ui.require.toUrl("demo/model/data.json"));`),
      paragraph("/model/data.json처럼 /로 시작하는 주소는 도메인 루트를 기준으로 합니다. 하위 경로에 배포하는 앱에서는 namespace 기준으로 리소스 URL을 해석하면 경로를 맞추기 쉽습니다.", "실습 원본의 getProperty(\"/disable\"=true)는 대입 위치가 잘못된 구문입니다. 값을 읽은 뒤 반전하여 setProperty로 기록하는 흐름으로 고칩니다."),
      code("모델의 boolean 전환", `const oModel = this.getView().getModel("shop");
const bDisabled = oModel.getProperty("/disable");
oModel.setProperty("/disable", !bDisabled);`)),
    source("zproject19_model2", "loadData, 모델 등록, 버튼 이벤트를 순서대로 읽습니다. 위 예제는 경로 처리와 boolean 변경 구문을 보완했습니다.")
  );
  extend("ui5-binding",
    section("부서 선택으로 직원 목록 바꾸기", paragraph("zproject25_elementbinding의 데이터는 data 배열 안에 department와 employee 배열이 들어 있습니다. ComboBox는 /data에, 직원 List는 상대경로 employee에 연결합니다. 선택한 부서 경로를 List에 bindElement하면 그 부서의 직원 배열이 기준이 됩니다."),
      code("기본 모델을 사용하는 XML 조각", `<ComboBox items="{/data}" selectionChange=".onDepartmentChange">
  <core:Item key="{department}" text="{department}" />
</ComboBox>
<List id="employees" items="{employee}">
  <StandardListItem title="{name}" />
</List>`), code("Controller 메서드", `onDepartmentChange: function (oEvent) {
  const oItem = oEvent.getParameter("selectedItem");
  const oList = this.byId("employees");
  if (!oItem) {
    oList.unbindElement();
    return;
  }
  oList.bindElement(oItem.getBindingContext().getPath());
}`), paragraph("XML View에 xmlns:core=\"sap.ui.core\"를 선언합니다. employee 앞에 /를 넣으면 루트에서 찾게 되어 부서 선택 문맥을 사용하지 못합니다.")),
    source("zproject25_elementbinding", "View25.controller.js의 중첩 데이터와 onDepartmentChange, View25.view.xml의 상대경로를 함께 확인합니다.")
  );
  extend("ui5-events",
    section("입력값 검증과 체크박스 이벤트", paragraph("10월 23일 PPT의 13~21쪽은 Input 값을 읽어 MessageBox에 전달하고 빈 입력을 검사하는 흐름입니다. placeholder는 안내 문구이므로 실제 입력값은 getValue로 읽습니다."),
      code("Controller 메서드 · MessageBox 의존성 필요", `onGreet: function () {
  const oInput = this.byId("customerName");
  const sName = oInput.getValue().trim();
  oInput.setValueState(sName ? "None" : "Error");
  if (!sName) {
    MessageBox.error("이름을 입력하세요.");
    return;
  }
  MessageBox.information("안녕하세요, " + sName + "님");
}`), paragraph("체크박스의 select 이벤트는 selected 파라미터로 boolean 상태를 전달합니다. getSource는 이벤트를 발생시킨 컨트롤이고 this.byId는 현재 View 범위에서 ID로 찾는 접근입니다.")),
    source("zproject8_checkbox", "체크 여부를 읽고 Text를 바꾸는 예제를 먼저 확인한 뒤 모델 바인딩으로 같은 동작을 표현해 보세요.")
  );
  extend("ui5-filter",
    section("항공사 실습에서 조건의 의미 정하기", paragraph("zproject30_preprocessprac는 ComboBox의 항공사 key를 읽어 carrId를 필터링하고 connId로 정렬합니다. 자유 입력 검색에는 Contains가 어울리고, 선택 목록의 정확한 코드에는 EQ가 의도를 더 분명하게 나타냅니다."),
      code("Controller 메서드 · Filter와 FilterOperator 필요", `onCarrierChange: function (oEvent) {
  const oItem = oEvent.getParameter("selectedItem");
  const aFilters = oItem
    ? [new Filter("carrId", FilterOperator.EQ, oItem.getKey())]
    : [];
  this.byId("table1").getBinding("items")
    .filter(aFilters, "Application");
}`), exercise("항공사 선택과 선택 해제를 반복하세요.", "선택 항목이 없을 때 getKey 호출 오류가 나지 않고 전체 목록으로 돌아오는지 확인합니다.")),
    source("zproject30_preprocessprac", "onCarrierChange, sorting, removefilter, removesorter에서 조건 생성과 바인딩 적용을 구분해 읽습니다.")
  );
  extend("ui5-format",
    section("입력 제약과 업무 포매터", paragraph("zproject29_modeldatatype는 할인율을 Integer 타입으로 바인딩하고 0~100 범위를 지정합니다. formatOptions는 표시 형식, constraints는 허용 값의 범위를 설정합니다. 앱의 검증 메시지 처리는 별도로 연결해야 합니다."),
      code("할인율 Input", `<Input value="{
  path: 'shop>/discount',
  type: 'sap.ui.model.type.Integer',
  constraints: { minimum: 0, maximum: 100 }
}" />`),
      code("model/formatter.js · 학습용 재구성", `sap.ui.define([], function () {
  "use strict";
  return {
    classText: function (sClass) {
      const mLabels = { E: "Economy", B: "Business", F: "First" };
      return mLabels[sClass] || "확인 필요";
    }
  };
});`), code("XML View 내부 · core namespace 필요", `<Text core:require="{formatter: 'demo/model/formatter'}"
  text="{path: 'shop>/class', formatter: 'formatter.classText'}" />`),
      exercise("할인율에 -1, 0, 100, 101을 입력하세요.", "경계값과 알 수 없는 좌석 코드의 표시를 확인합니다.")),
    source("zproject29_modeldatatype", "View29.view.xml의 constraints, core:require와 model/formatter.js를 연결해 읽습니다.")
  );
  extend("ui5-dialog", source("zux_22_exam", "Main.controller.js의 onOrderdetail은 버튼의 ProductID를 읽어 팝업 목록을 필터링합니다. 시험 PDF 9~10쪽은 제품 경로를 Dialog에 Element Binding하는 연습을 요구하므로 두 방식의 문맥 연결 지점을 비교하세요."));
  extend("ui5-i18n",
    section("앱 제목과 화면 문구의 연결", paragraph("zproject32_localization의 manifest.json에서 sap.app.title은 리소스 키 appTitle을 참조합니다. sap.ui5.models.i18n은 XML View가 사용하는 ResourceModel을 정의합니다. bundleName은 점으로 구분한 namespace 경로입니다.", "언어별 파일에 키가 누락되면 대체 번들의 문구가 사용될 수 있습니다. 지원 언어 파일마다 같은 키가 있는지 확인하고 변수 자리표시자의 순서도 유지합니다.")),
    source("zproject32_localization", "manifest.json의 supportedLocales와 fallbackLocale, i18n 폴더의 언어별 파일을 비교합니다.")
  );
  extend("ui5-odata",
    section("manifest에서 서비스와 모델 연결", paragraph("zproject33_odata는 sap.app.dataSources.mainService에 /V2/Northwind/Northwind.svc/와 odataVersion 2.0을 선언하고, sap.ui5.models의 빈 이름 모델에 mainService를 연결합니다. 따라서 XML의 {/Customers}는 기본 OData 모델을 사용합니다."),
      table(["설정", "확인할 내용"], [
        ["sap.app.dataSources", "서비스 URI와 OData 버전"],
        ["sap.ui5.models", "모델 이름과 dataSource 참조"],
        ["ui5.yaml 등 개발 서버 설정", "상대 URI 요청이 실제 서비스에 도달하는 프록시 경로"],
        ["Network의 $metadata", "서비스 접근과 엔티티 정의 로딩 성공 여부"]
      ]), paragraph("시험 PDF 4쪽은 V4 URL을 적고 5~9쪽은 V2 URL을 사용합니다. 위키의 실습은 저장소 manifest와 상세 요구사항에 맞춰 V2로 통일했습니다. V4 프로젝트에 적용할 때는 모델 API와 메타데이터를 다시 확인합니다.")),
    source("zproject33_odata", "manifest.json에서 서비스 선언을 읽은 뒤 View33.controller.js의 고객 선택 → 상세 테이블 문맥 연결을 추적합니다.")
  );
  extend("ui5-orders",
    section("최종 주문 앱의 두 모델", paragraph("zproject37_ordersearch는 기본 OData 모델에서 주문을 읽고 list라는 JSONModel에 화면용 데이터를 저장합니다. list 모델은 orders, productImages, orderSummary, summaryCounts를 보유합니다.", "_readOrders는 서버가 __next를 반환하면 다음 페이지를 이어 읽습니다. _showOrders는 주문 상세를 합산하고 화면용 속성을 만듭니다. onSortChange는 list 모델의 항목을 정렬하고 화면 행 번호를 다시 부여합니다."),
      table(["함수", "읽을 이유"], [
        ["_createSearchFilters", "주문 번호, 고객명, 날짜, 출하 상태를 검색 조건으로 변환"],
        ["_clearSearchResults", "이전 선택·배송 문맥·이미지 상태 초기화"],
        ["_readOrders", "여러 페이지 결과를 모으는 조회 흐름"],
        ["_showOrders", "화면용 계산 속성과 주문 합계 생성"],
        ["onSortChange", "누락 날짜, 납기 거리, 주문 번호를 활용한 복수 정렬"]
      ])),
    section("기준일에 따른 상태 해석", paragraph("최종 발표 PDF 4~5쪽은 주문·상세·상품·공급업체·고객·배송업체 관계와 네 영역 화면을 보여줍니다. 저장소의 검색 로직은 기준일 다음 날을 경계로 사용해 기준일 당일까지의 주문을 포함합니다.", "기준일 당시 진행 중인 주문은 출하일이 없거나 기준일 이후에 출하된 주문입니다. 현재 시점의 출하 여부와 과거 기준일의 상태를 구분해야 합니다. 날짜 경계를 만들 때 서비스가 기대하는 시간대와 날짜 자료형을 확인합니다.", "발표 설계의 공급업체 검색과 실제 코드의 고객사명 검색은 다릅니다. 현재 _createSearchFilters는 Customer/CompanyName을 사용하므로 문서에서도 고객 검색으로 설명합니다."),
      exercise("기준일 전후의 출하일을 가진 주문을 비교하세요.", "출하일 없음, 기준일 당일 출하, 기준일 다음 날 출하의 세 경우를 점검합니다.")),
    source("zproject37_ordersearch", "Main.controller.js, view의 Fragment, model/formatter.js를 함께 읽습니다. 위 설명은 저장소 커밋 479e061 기준입니다.")
  );

  lessons.splice(1, 0, {
    id: "ui5-layout", title: "레이아웃과 폼 구성", aliases: ["SimpleForm", "HBox", "VBox"],
    summary: "화면 영역을 나누고 라벨·입력·동작 버튼의 관계를 구성합니다.",
    sections: [
      section("컨테이너 선택", table(["컨트롤", "배치 목적"], [
        ["VBox", "위에서 아래로 순서가 있는 내용"], ["HBox", "가로 방향의 짧은 그룹"],
        ["SimpleForm", "라벨과 입력 필드의 반복"], ["Panel", "제목을 가진 정보 영역"],
        ["Toolbar와 ToolbarSpacer", "제목과 오른쪽 동작 버튼 배치"]
      ])),
      section("폼의 라벨과 입력", paragraph("zproject12_form의 SimpleForm은 toolbar와 content를 분리합니다. Label 다음에 입력 컨트롤을 배치하고 labelFor로 입력 ID를 연결하면 라벨과 입력의 관계를 명시할 수 있습니다. View에 xmlns:f=\"sap.ui.layout.form\"을 선언합니다."),
        code("XML View 내부", `<f:SimpleForm layout="ResponsiveGridLayout" editable="true">
  <f:toolbar>
    <Toolbar>
      <Title text="검색 조건" />
      <ToolbarSpacer />
      <Button text="조회" press=".onSearch" />
    </Toolbar>
  </f:toolbar>
  <f:content>
    <Label text="고객명" labelFor="customerName" />
    <Input id="customerName" />
    <Label text="기준일" labelFor="referenceDate" />
    <DatePicker id="referenceDate" />
  </f:content>
</f:SimpleForm>`)),
      section("화면 크기와 밀도", paragraph("좁은 화면에서는 검색 필드와 결과 패널이 자연스럽게 줄바꿈되어야 합니다. 가로 고정 폭을 많이 주면 입력 영역과 버튼이 화면 밖으로 밀릴 수 있습니다. compact/cozy 밀도는 조작 환경에 맞게 선택하고 실제 앱에 적용된 CSS 클래스도 확인합니다."),
        exercise("창 폭을 줄여 검색 폼을 확인하세요.", "라벨·입력 연결, 버튼 줄바꿈, 키보드 탭 순서를 확인합니다.")),
      source("zproject12_form", "View12.view.xml의 ResponsiveGridLayout, ColumnLayout과 toolbar 구성을 확인합니다. 학습 예제의 입력값은 일반적인 검색 폼으로 재구성했습니다.")
    ]
  });
  lessons.splice(7, 0, {
    id: "ui5-expression", title: "표현식 바인딩과 입력 상태", aliases: ["Expression Binding"],
    summary: "간단한 조건을 XML에 표현해 버튼 활성화와 상태 표시를 데이터에 연결합니다.",
    sections: [
      section("입력값에 따라 버튼 활성화", paragraph("zproject29_modeldatatype의 고객 등록 버튼은 고객명이 있을 때 활성화됩니다. Input의 valueLiveUpdate를 켜면 입력 중에도 모델 값이 갱신되어 조건을 즉시 평가할 수 있습니다."),
        code("XML View 내부 · shop 모델에 customerName 초기값 필요", `<Input value="{shop>/customerName}" valueLiveUpdate="true" />
<Button text="등록"
  enabled="{= !!\${shop>/customerName} &amp;&amp; \${shop>/customerName}.trim().length > 0 }"
  press=".onCreate" />`), paragraph("XML에서 논리 AND의 두 &amp; 문자는 각각 이스케이프해야 합니다. 복잡한 업무 규칙이나 여러 화면에서 재사용하는 변환은 formatter로 분리하면 읽기 쉽습니다.")),
      section("표시 조건과 입력 검증", paragraph("버튼의 enabled는 화면에서 가능한 동작을 안내합니다. onCreate에서도 입력을 검사해야 코드에서 직접 호출하거나 데이터가 바뀌는 경우를 처리할 수 있습니다."),
        exercise("빈 문자열, 공백만 있는 값, 정상 이름을 넣어 보세요.", "입력 중 버튼 상태와 실제 등록 핸들러의 검증 결과가 일치해야 합니다.")),
      source("zproject29_modeldatatype", "표현식은 View29.view.xml의 고객 등록 버튼에 구현돼 있습니다. zproject31_exprb의 View31은 본문이 비어 있어 이 문서의 예제는 View29를 기준으로 보완했습니다."),
      section("공식 문서", paragraph('<a href="https://ui5.sap.com/1.38.69/docs/guide/5cff8d1c3fb84c5db7a00f2daca125af.html" target="_blank" rel="noopener noreferrer">SAP 표현식 바인딩과 XML 문자 이스케이프</a>'))
    ]
  });
  lessons.splice(lessons.findIndex(lesson => lesson.id === "ui5-orders"), 0, {
    id: "ui5-exam", title: "카테고리 조회 6단계 실습", aliases: ["suspended", "resume"],
    summary: "시험 PDF의 요구사항을 따라 카테고리·제품·공급업체·판매·주문상세를 연결합니다.",
    sections: [
      section("단계별 완료 조건", table(["단계", "구현", "확인할 결과"], [
        ["1", "프로젝트와 OData 모델 준비", "$metadata 로딩 성공"],
        ["2", "Categories ComboBox와 조회 버튼", "CategoryID와 CategoryName 연결"],
        ["3", "선택한 Category의 Products 표시", "다른 카테고리 선택 시 목록 교체"],
        ["4", "선택 제품의 Supplier 표시", "제품 선택과 공급업체 정보 일치"],
        ["5", "Sales_by_Categories 조회와 상태 아이콘", "선택 조건과 금액 구간 반영"],
        ["6", "제품의 Order_Details 팝업", "누른 행의 주문상세와 닫기 동작"]
      ]), paragraph("출처는 SAPCODE_2nd_UX_Exam.pdf 4~10쪽입니다. 아래 예제는 기본 V2 모델과 PDF의 엔티티명을 전제로 재구성했습니다.")),
      section("Category 문맥에서 Products 조회", code("XML View 내부 · core namespace 필요", `<ComboBox id="category" items="{/Categories}">
  <core:Item key="{CategoryID}" text="{CategoryName}" />
</ComboBox>
<Button text="조회" press=".onSearchProducts" />
<List id="productList" items="{Products}">
  <StandardListItem title="{ProductName}" />
</List>`), code("Controller 메서드", `onSearchProducts: function () {
  const oItem = this.byId("category").getSelectedItem();
  if (!oItem) {
    this.byId("category").setValueState("Error");
    return;
  }
  this.byId("category").setValueState("None");
  this.byId("productList").bindElement(
    oItem.getBindingContext().getPath()
  );
}`), paragraph("Products는 선택한 Category의 Navigation Property입니다. /Products로 바꾸면 전체 제품 EntitySet을 읽게 됩니다. 제품 선택 뒤 상세 영역에는 선택 제품 경로에 /Supplier를 이어 bindElement합니다.")),
      section("판매 목록의 요청 시점 제어", paragraph("PDF 8쪽은 초기 조회를 suspended로 미루고 버튼 클릭 후 resume으로 재개하도록 요구합니다. visible=false는 화면 표시만 제어하므로 데이터 요청 여부는 바인딩에서 확인합니다."),
        code("XML View 내부", `<List id="sales" items="{path: '/Sales_by_Categories', suspended: true}">
  <StandardListItem title="{ProductName}" description="{ProductSales}" />
</List>`), code("Controller 메서드 · Filter, FilterOperator 필요", `onLoadSales: function () {
  const oItem = this.byId("category").getSelectedItem();
  if (!oItem) { return; }
  const iCategoryId = oItem.getBindingContext().getProperty("CategoryID");
  const oBinding = this.byId("sales").getBinding("items");
  oBinding.filter([
    new Filter("CategoryID", FilterOperator.EQ, iCategoryId)
  ], "Application");
  if (oBinding.isSuspended()) {
    oBinding.resume();
  }
}`), exercise("새로고침 직후와 판매 버튼 클릭 후 Network를 비교하세요.", "초기 판매 요청이 없는지, 조회 시 CategoryID 조건이 들어가는지 확인합니다. UI5 버전과 모델 종류에 따른 동작도 확인합니다.")),
      section("판매 금액의 경계값", code("formatter 객체에 추가할 메서드", `salesIcon: function (vAmount) {
  if (vAmount === null || vAmount === undefined || vAmount === "") {
    return "sap-icon://question-mark";
  }
  const nAmount = Number(vAmount);
  if (!Number.isFinite(nAmount)) { return "sap-icon://question-mark"; }
  if (nAmount <= 5000) { return "sap-icon://error"; }
  if (nAmount <= 10000) { return "sap-icon://alert"; }
  return "sap-icon://sys-enter-2";
}`), paragraph("PDF의 기준은 5,000 이하, 5,000 초과 10,000 이하, 10,000 초과입니다. 5,000과 10,000을 각각 테스트해야 조건의 등호가 정확한지 알 수 있습니다.")),
      source("zux_22_exam", "Main.controller.js의 onCategoryChange, onSelectionChange, onSalesbyCategory, onOrderdetail을 단계별로 연결합니다. 원본은 제품 목록을 Filter로 제한하므로 PDF의 Element Binding 요구사항과 비교해 학습합니다.")
    ]
  });

  for (const [index, lesson] of lessons.entries()) {
    window.WIKI_DOCS[lesson.id] = {
      track: "ui5", subtitle: "", tcodes: [], specs: {},
      categoryId: "ui5-curriculum",
      stepNum: lesson.categoryId ? "" : String(index + 1).padStart(2, "0"),
      ...lesson
    };
  }
  Object.assign(window.WIKI_DOCS["welcome-ui5"], {
    summary: "화면을 만들고 데이터를 연결한 뒤 주문 조회 앱으로 완성하는 UI5 학습 과정입니다.",
    sections: [
      section("학습 순서", table(["순서", "주제"], lessons.filter(lesson => !lesson.categoryId).map((lesson, index) => [
        String(index + 1), `[[${lesson.id}|${lesson.title}]]`
      ]))),
      section("자료와 예제 사용법", paragraph(
        "수업 필기와 10월 21~23일 UI5 PPT, BAS 설정 가이드, SAPCODE_2nd_UX_Exam.pdf, 주문 조회 발표 PPT·PDF, SAPUI5-PRACTICE의 실습 코드를 함께 참고했습니다. 각 문서의 실습 원본 링크는 검토한 커밋을 가리킵니다.",
        "코드 예제는 학습용으로 재구성했습니다. Controller 예제의 모듈은 sap.ui.define 의존성에 등록하고, demo namespace는 실제 프로젝트 이름에 맞춥니다. OData 예제는 V2 기준입니다.",
        "[[ui5-troubleshooting|오류 점검표]]와 [[ui5-controls|컨트롤 · API 빠른 참조]]를 함께 활용하세요."
      ))
    ]
  });
})();
