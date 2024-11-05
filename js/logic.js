const inputsRadio = document.querySelectorAll('input[type="radio"]');

const types = {
  pfSimples: { registrationType: "simples", typeOfPerson: "PF" },
  pfCompleto: { registrationType: "complete", typeOfPerson: "PF" },
  pjSimples: { registrationType: "simples", typeOfPerson: "PJ" },
  pjCompleto: { registrationType: "complete", typeOfPerson: "PJ" },
};

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const inputRadio = Array.from(inputsRadio).find((input) => input.checked);

  if (inputRadio) {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: generatePerson,
      args: [
        types[inputRadio.value].registrationType,
        types[inputRadio.value].typeOfPerson,
      ],
    });

    const intervalId = setInterval(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFiles,
        args: [types[inputRadio.value].registrationType],
      });
    }, 1000);

    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "clearInterval") {
        clearInterval(intervalId);
      }
    });
  } else {
    alert("Preencha a informação solicitada.");
  }
});

function fillFiles(registrationType) {
  const isComplete = registrationType === "complete";

  function addPaymentDetails() {
    const mainButton = document.querySelector('[id^="Forma de pagamento"]');
    mainButton.click();

    const intervalId = setInterval(() => {
      const listOfItems = document.querySelectorAll("li");
      const billElement = Array.from(listOfItems).find(
        (element) => element.textContent.trim() === "Boleto"
      );

      if (billElement) {
        billElement.click();
        clearInterval(intervalId);
      }
    }, 100);
  }

  const fileFields = document.querySelectorAll('input[type="file"]');

  if (!document.getElementById("stopElement") && fileFields.length > 0) {
    async function generateFile(url) {
      const response = await fetch(url);
      const pdfBlob = await response.blob();

      const file = new File([pdfBlob], "meuArquivo.pdf", {
        type: "application/pdf",
      });

      return file;
    }

    async function fillInFileFields() {
      const file = await generateFile(
        "https://www.thecampusqdl.com/uploads/files/pdf_sample_2.pdf"
      );

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      for (const fileField of fileFields) {
        fileField.files = dataTransfer.files;

        const event = new Event("change", {
          bubbles: true,
          cancelable: true,
        });

        fileField.dispatchEvent(event);
      }
    }

    fillInFileFields();

    if (isComplete) {
      addPaymentDetails();
    }
    chrome.runtime.sendMessage({ action: "clearInterval" });
  }
}

async function generatePerson(registrationType, typeOfPerson) {
  function cpfFormat(cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  function phoneFormat(phone) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }

  function zipCodeFormat(zipCode) {
    return zipCode.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  function issueDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const formattedDate = `${day}/${month}/${year}`;
    return formattedDate;
  }

  function expirationDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const formattedDate = `${day}/${month}/${year + 1}`;
    return formattedDate;
  }

  function generateSimplePf(profile) {
    return {
      tipoPessoa: "fisica",
      nomeCompleto: profile.nome,
      cpf: cpfFormat(profile.cpf),
      dadosEmpresa: {},
      produto: "Todos",
      checkboxes: {
        edital: false,
        institucional: false,
        fornecedorBens: false,
        fornecedorServicos: true,
      },
      email: profile.email,
      telefone: phoneFormat(profile.celular),
      tipoCadastro: "simples",
    };
  }

  function generateCompletePf(profile) {
    return {
      tipoPessoa: "fisica",
      nomeCompleto: profile.nome,
      dadosEmpresa: {},
      cpf: cpfFormat(profile.cpf),
      produto: "Todos",
      dadosPagamentos: [],
      checkboxes: {
        edital: false,
        institucional: true,
        fornecedorBens: false,
        fornecedorServicos: false,
      },
      email: profile.email,
      telefone: phoneFormat(profile.celular),
      tipoCadastro: "completo",
      dataEmissaoComprovanteEndereco: issueDate(),
      bairro: profile.bairro,
      cidade: profile.cidade,
      estado: profile.estado,
      endereco: profile.endereco,
      cep: zipCodeFormat(profile.cep),
      tipoDocIdentificacao: "RG",
      docIdentificacao: profile.rg,
      dataNascimento: profile.data_nasc,
      identidadeDeGenero: "NAO_INFORMADO",
      estadoNascimento: "CE",
      cidadeNascimento: "Fortaleza",
      nomeMae: profile.mae,
      racaCor: "negroPreto",
      estadoCivil: "casado",
      nivelEscolaridade: "fundamentalIncompleto",
      numero: profile.numero,
    };
  }

  function generateCompletePj(profilePf, cnpj) {
    return {
      tipoPessoa: "juridica",
      nomeCompleto: profilePf.nome,
      cpf: cpfFormat(profilePf.cpf),
      dadosEmpresa: {
        razaoSocial: `${profilePf.nome} - LTDA`,
        nomeFantasia: "LTDA",
        cnpj: cnpj,
        produto: "Todos",
        tipoEmpresa: "ME_OU_OUTROS",
        codigosCNAE: [
          "0141-5/02 - PRODUÇÃO DE SEMENTES CERTIFICADAS DE FORRAGEIRAS PARA FORMAÇÃO DE PASTO",
        ],
        endereco: {
          cep: zipCodeFormat(profilePf.cep),
          endereco: profilePf.endereco,
          bairro: profilePf.bairro,
          cidade: profilePf.cidade,
          estado: profilePf.estado,
          numero: profilePf.numero,
        },
      },
      dadosPagamentos: [],
      checkboxes: {
        edital: false,
        institucional: false,
        fornecedorBens: false,
        fornecedorServicos: true,
      },
      email: profilePf.email,
      telefone: phoneFormat(profilePf.celular),
      tipoCadastro: "completo",
      validadeCertidaoCaixaFGTS: expirationDate(),
      validadeCertidaoMunicipal: expirationDate(),
      validadeCertidaoEstadual: expirationDate(),
      validadeCertidaoFederal: expirationDate(),
      validadeCertidaoCRF: expirationDate(),
      dataEmissaoComprovanteEndereco: issueDate(),
      dataEmissaoCertidaoCaixaFGTS: issueDate(),
      dataEmissaoCertidaoMunicipal: issueDate(),
      dataEmissaoCertidaoEstadual: issueDate(),
      dataEmissaoCertidaoFederal: issueDate(),
      dataEmissaoCertidaoCRF: issueDate(),
      tipoDocIdentificacao: "RG",
      docIdentificacao: profilePf.rg,
    };
  }

  function generateSimplePj(profilePf, cnpj) {
    return {
      tipoPessoa: "juridica",
      dadosEmpresa: {
        razaoSocial: `${profilePf.nome} - LTDA`,
        nomeFantasia: "LTDA",
        cnpj: cnpj,
        produto: "Todos",
        tipoEmpresa: "ME_OU_OUTROS",
        codigosCNAE: [
          "0141-5/02 - PRODUÇÃO DE SEMENTES CERTIFICADAS DE FORRAGEIRAS PARA FORMAÇÃO DE PASTO",
        ],
      },
      dadosPagamentos: [],
      checkboxes: {
        edital: false,
        institucional: false,
        fornecedorBens: false,
        fornecedorServicos: true,
      },
      email: profilePf.email,
      telefone: phoneFormat(profilePf.celular),
      tipoCadastro: "simples",
    };
  }

  async function generatePfData(type) {
    const isComplete = type === "complete";

    const url =
      "https://corsproxy.io/?https://www.4devs.com.br/ferramentas_online.php";

    const params = new URLSearchParams({
      acao: "gerar_pessoa",
      sexo: "I",
      idade: "0",
      cep_estado: "",
      txt_qtde: "1",
      cep_cidade: "",
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await response.text();

      try {
        const profile = JSON.parse(data)[0];

        localStorage.removeItem("partnerFormData");

        localStorage.setItem(
          "partnerFormData",
          JSON.stringify(
            isComplete ? generateCompletePf(profile) : generateSimplePf(profile)
          )
        );
      } catch (error) {
        console.error("Erro ao converter para JSON:", error);
      }
    } catch (error) {
      console.error("Erro ao acessar a API:", error);
    }
  }

  async function generatePjData(type) {
    const isComplete = type === "complete";

    const url =
      "https://corsproxy.io/?https://www.4devs.com.br/ferramentas_online.php";

    const paramsPf = new URLSearchParams({
      acao: "gerar_pessoa",
      sexo: "I",
      idade: "0",
      cep_estado: "",
      txt_qtde: "1",
      cep_cidade: "",
    });

    const paramsCnpj = new URLSearchParams({
      acao: "gerar_cnpj",
      pontuacao: "S",
    });

    try {
      const promisePf = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paramsPf.toString(),
      });

      const promiseCnpj = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paramsCnpj.toString(),
      });

      const [responsePf, responseCnpj] = await Promise.all([
        promisePf,
        promiseCnpj,
      ]);

      try {
        const dataPf = await responsePf.text();
        const cnpj = await responseCnpj.text();
        const profilePf = JSON.parse(dataPf)[0];

        localStorage.removeItem("partnerFormData");

        localStorage.setItem(
          "partnerFormData",
          JSON.stringify(
            isComplete
              ? generateCompletePj(profilePf, cnpj)
              : generateSimplePj(profilePf, cnpj)
          )
        );
      } catch (e) {
        console.error("Erro ao converter para JSON:", e);
      }
    } catch (error) {
      console.error("Erro ao acessar a API:", error);
    }
  }

  if (typeOfPerson === "PF") {
    await generatePfData(registrationType);
  } else {
    await generatePjData(registrationType);
  }

  const li = document.createElement("li");
  li.id = "stopElement";
  document.body.appendChild(li);

  const currentUrl = new URL(window.location.href);
  let pathname = currentUrl.pathname;

  const newState = registrationType === "complete" ? "complete" : "simple";

  if (/\/simple|\/complete/.test(pathname)) {
    pathname = pathname.replace(/\/simple|\/complete/, `/${newState}`);
  } else {
    pathname += `/${newState}`;
  }

  currentUrl.pathname = pathname;

  window.location.href = currentUrl.toString();
}
