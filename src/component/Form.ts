import { BigNumber, utils } from "ethers";
import { DomNode, el } from "skydapp-browser";
import CommonUtil from "../CommonUtil";
import GaiaBridgeInterface from "../contract/GaiaBridgeInterface";
import EthereumWallet from "../ethereum/EthereumWallet";
import KlaytnWallet from "../klaytn/KlaytnWallet";
import Swaper from "./Swaper";

export default class Form extends DomNode {
    public sender: GaiaBridgeInterface | undefined;

    private chainIcon: DomNode<HTMLImageElement>;
    private chainSelect: DomNode<HTMLSelectElement>;
    private balanceDisplay: DomNode;
    private addressDisplay: DomNode;
    private disconnectButton: DomNode;
    private buttonContainer: DomNode;

    constructor(
        private swaper: Swaper,
        public chainId: number,
        private isFrom: boolean = false
    ) {
        super("form")
        this.append(
            this.chainIcon = el("img", { src: "/images/shared/icn/klaytn.svg", alt: "chain image" }),
            this.isFrom ? el(".caption-container", el("span", "from"), el("p", "보내는 체인")) :
                el(".caption-container", el("span", "to"), el("p", "받는 체인")),
            this.chainSelect = el("select",
                el("option", "Klaytn", { value: "8217" }),
                el("option", "Ethereum", { value: "1" }),
                {
                    change: () => {
                        const originChainId = this.chainId;
                        this.changeChain(parseInt(this.chainSelect.domElement.value, 10));
                        this.fireEvent("changeChain", this.chainId, originChainId);
                    },
                }
            ),
            (this.balanceDisplay = el("p")),
            el(".address-container",
                (this.addressDisplay = el("p")),
                (this.disconnectButton = el("a.disconnect",
                    el("img", { src: "/images/shared/icn/disconnect.svg" })
                )),
            ),
            (this.buttonContainer = el(".button-container")),
        );
        this.changeChain(chainId);
    }

    public async changeChain(chainId: number) {
        this.chainId = chainId;
        this.chainSelect.domElement.value = String(chainId);

        this.sender?.off("connect", this.connectHandler);
        this.sender?.off("Transfer", this.transferHandler);
        this.sender?.off("SendToken", this.sendHandler);

        if (chainId === 8217) {
            this.chainIcon.domElement.src = "/images/shared/icn/klaytn.png";

            const address = await KlaytnWallet.loadAddress();
            if (address !== undefined) {
                this.addressDisplay.empty().appendText(CommonUtil.shortenAddress(address!));
            } else {
                this.addressDisplay.empty();
            }
        } else if (chainId === 1) {
            this.chainIcon.domElement.src = "/images/shared/icn/ethereum.png";

            const address = await EthereumWallet.loadAddress();
            if (address !== undefined) {
                this.addressDisplay.empty().appendText(CommonUtil.shortenAddress(address!));
            } else {
                this.addressDisplay.empty();
            }
        }
        await this.loadBalance();

        this.sender?.on("connect", this.connectHandler);
        this.sender?.on("Transfer", this.transferHandler);
        this.sender?.on("SendToken", this.sendHandler);
    }

    private async loadBalance() {
        this.buttonContainer.empty();

        if (this.sender !== undefined) {
            const owner = await this.sender.loadAddress();
            if (owner !== undefined) {
                const balance = await this.sender.balanceOf(owner);
                this.balanceDisplay
                    .empty()
                    .appendText(`${utils.formatUnits(balance)} NFT`);
                this.buttonContainer.append(
                    el("a.add-token-to-wallet-button", "지갑에 토큰 추가하기", {
                        click: () => {
                            this.sender?.addTokenToWallet();
                        },
                    }),
                );
            } else {
                this.disconnectButton.empty();
                this.balanceDisplay.empty().appendText("잔액 불러오기 실패");
                this.buttonContainer.append(
                    el("a.connect-button", "지갑 연결", {
                        click: () => this.sender?.connect(),
                    }),
                );
            }
        }
    }

    private connectHandler = async () => {
        this.fireEvent("connect");
        this.loadBalance();
    };

    private transferHandler = async (from: string, to: string) => {
        const owner = await this.sender?.loadAddress();
        if (from === owner || to === owner) {
            this.loadBalance();
        }
    };

    private sendHandler = async (
        sender: string,
        toChainId: BigNumber,
        receiver: string,
        amount: BigNumber,
        sendingId: BigNumber,
    ) => {
        this.swaper.receive(sender, toChainId, receiver, sendingId, amount);
        const owner = await this.sender?.loadAddress();
        if (sender === owner) {
            this.swaper.addSended(sender, receiver, sendingId);
        }
    };

    public delete() {
        this.sender?.off("connect", this.connectHandler);
        this.sender?.off("Transfer", this.transferHandler);
        this.sender?.off("SendToken", this.sendHandler);
        super.delete();
    }
}