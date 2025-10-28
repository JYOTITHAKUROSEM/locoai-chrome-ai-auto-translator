const AutoTranslator = (function (window, $) {
    // get Loco Translate global object.  
    const locoConf = window.locoConf || {};
    // get plugin configuration object.
    const configData = window.extradata || {};
    let translationPerformed = false;
    const { ajax_url: ajaxUrl, nonce: nonce, LCAT_URL: LCAT_URL, extra_class: rtlClass, api_key: apikey, dashboard_url: dashboardurl } = configData;
    const allStrings = locoConf.conf.podata;
    // Safely access nested properties without optional chaining
    let pluginOrThemeName = '';

    if (locoConf && locoConf.conf && locoConf.conf.project && locoConf.conf.project.bundle) {
        const isTheme = locoConf.conf.project.bundle.startsWith('theme.');

        if (isTheme) {
            pluginOrThemeName = locoConf.conf.project.domain || '';
        } else {
            const match = locoConf.conf.project.bundle.match(/^[^.]+\.(.*?)(?=\/)/);
            pluginOrThemeName = match ? match[1] : '';
        }
    }

    onLoad();
    function onLoad() {
        if (locoConf && locoConf.conf) {
            const { conf } = locoConf;
            // get all string from loco translate po data object
            allStrings.shift();
            const { locale, project } = conf;
            // create a project ID for later use in ajax request.
            const projectId = generateProjectId(project, locale);
            // create strings modal

            createStringsModal(projectId, 'ChromeAiTranslator');
            addStringsInModal(allStrings);
        }
    }

    function initialize() {

        const { conf } = locoConf;
        const { locale, project } = conf;
        const projectId = generateProjectId(project, locale);
        // Embbed Auto Translate button inside Loco Translate editor
        if ($("#loco-editor nav").find("#cool-auto-translate-btn").length === 0) {
            addAutoTranslationBtn();
        }

        //append auto translate settings model
        settingsModel();

        // on auto translate button click settings model
        $("#cool-auto-translate-btn").on("click", openSettingsModel);

        // open translation provider model 
        $("button.icon-robot[data-loco='auto']").on("click", openTranslationProviderModel);



        // open model with Chrome AI Translator
        $("#ChromeAiTranslator_settings_btn").on("click", function () {
            openChromeAiTranslatorModel(locale);
        });

        // save string inside cache for later use
        $(".lcat_save_strings").on("click", onSaveClick);

    }


    function addStringsInModal(allStrings) {
        var plainStrArr = filterRawObject(allStrings, "plain");
        if (plainStrArr.length > 0) {
            printStringsInPopup(plainStrArr, type = "ChromeAiTranslator");
        } else {
            $(".notice-container")
                .addClass('notice inline notice-warning')
                .html("There is no plain string available for translations.");
            $(".lcat_string_container, .choose-lang, .lcat_save_strings, .translator-widget, .notice-info, .is-dismissible").hide();
        }
    }

    // create project id for later use inside ajax request.
    function generateProjectId(project, locale) {
        const { domain } = project || {};
        const { lang, region } = locale;
        return project ? `${domain}-${lang}-${region}` : `temp-${lang}-${region}`;
    }




    async function openChromeAiTranslatorModel(locale) {
        var defaultcode = locale.lang ? locale.lang : null;
        switch (defaultcode) {
            case 'bel':
                defaultlang = 'be';
                break;
            case 'he':
                defaultlang = 'iw';
                break;
            case 'snd':
                defaultlang = 'sd';
                break;
            case 'jv':
                defaultlang = 'jw';
                break;
            case 'nb':
                defaultlang = 'no';
                break;

            case 'nn':
                defaultlang = 'no';
                break;
            default:
                defaultlang = defaultcode;
                break;
        }

        let modelContainer = $('div#ChromeAiTranslator-widget-model.ChromeAiTranslator-widget-container');
        modelContainer.find(".lcat_actions > .lcat_save_strings").prop("disabled", true);
        modelContainer.find(".lcat_stats").hide();

        $("#lcat-dialog").dialog("close");
        modelContainer.fadeIn("slow");
        // modelContainer.find('.notice, .inline, .notice-info, .is-dismissible').show();

        if (translationPerformed) {
            $("#ChromeAiTranslator-widget-model").find(".lcat_save_strings").prop("disabled", false);
        }
    }

    // parse all translated strings and pass to save function
    function onSaveClick() {
        let translatedObj = [];
        let type = this.getAttribute("data-type");
        let total_character_count = 0;
        let total_word_count = 0;
        const rpl = {
            '"% s"': '"%s"',
            '"% d"': '"%d"',
            '"% S"': '"%s"',
            '"% D"': '"%d"',
            '% s': ' %s ',
            '% S': ' %s ',
            '% d': ' %d ',
            '% D': ' %d ',
            '٪ s': ' %s ',
            '٪ S': ' %s ',
            '٪ d': ' %d ',
            '٪ D': ' %d ',
            '٪ س': ' %s ',
            '%S': ' %s ',
            '%D': ' %d ',
            '% %': '%%'
        };

        const regex = /(\%\s*\d+\s*\$?\s*[a-z0-9])/gi;

        $("." + type + "-widget-body").find(".lcat_strings_table tbody tr").each(function () {
            const source = $(this).find("td.source").text();
            const target = $(this).find("td.target").text();

            const improvedTargetrpl = strtr(target, rpl);
            const improvedSourcerpl = strtr(source, rpl);

            const improvedTarget = improvedTargetrpl.replace(regex, function (match) {
                return match.replace(/\s/g, '').toLowerCase();
            });

            const improvedSource = improvedSourcerpl.replace(regex, function (match) {
                return match.replace(/\s/g, '').toLowerCase();
            });

            total_character_count += improvedSource.length;
            total_word_count += improvedSource.split(/\s+/).length;

            translatedObj.push({
                "source": improvedSource,
                "target": improvedTarget
            });
        });

        const container = $(this).closest('.lcat_custom_model');
        const translationProvider = container.data('translation-provider');
        const translationTime = container.data('translation-time');
        const { lang, region } = locoConf.conf.locale;
        const target_language = region ? `${lang}_${region}` : lang;
        const totalCharacters = translatedObj.reduce((sum, item) => sum + item.source.length, 0);
        const totalStrings = translatedObj.length;

        const translationData = {
            time_taken: translationTime,
            translation_provider: translationProvider,
            character_count: totalCharacters,
            string_count: totalStrings,
            pluginORthemeName: pluginOrThemeName,
            target_language: target_language,
        }

        var projectId = $(this).parents(".lcat_custom_model").find("#project_id").val();

        //  Save Translated Strings
        saveTranslatedStrings(translatedObj, projectId, translationData);
        $(".lcat_custom_model").fadeOut("slow");
        $("html").addClass("merge-translations");
        updateLocoModel();
    }

    // update Loco Model after click on merge translation button
    function updateLocoModel() {
        var checkModal = setInterval(function () {
            var locoModel = $('.loco-modal');
            var locoModelApisBatch = $('.loco-modal #loco-apis-batch');
            if (locoModel.length && // model exists check
                locoModel.attr("style").indexOf("none") <= -1 && // has not display none
                locoModel.find('#loco-job-progress').length // element loaded 
            ) {
                $("html").removeClass("merge-translations");
                locoModelApisBatch.find("a.icon-help, a.icon-group, #loco-job-progress").hide();
                locoModelApisBatch.find("select#auto-api").hide();
                var currentState = $("select#auto-api option[value='loco_auto']").prop("selected", "selected");
                locoModelApisBatch.find("select#auto-api").val(currentState.val());
                locoModel.find(".ui-dialog-titlebar .ui-dialog-title").html("Step 3 - Add Translations into Editor and Save");
                locoModelApisBatch.find("button.button-primary span").html("Start Adding Process");
                locoModelApisBatch.find("button.button-primary").on("click", function () {
                    $(this).find('span').html("Adding...");
                });
                locoModel.addClass("addtranslations");
                $('.noapiadded').remove();
                locoModelApisBatch.find("form").show();
                locoModelApisBatch.removeClass("loco-alert");
                clearInterval(checkModal);
            }
        }, 200); // check every 200ms
    }
    function openTranslationProviderModel(e) {
        if (e.originalEvent !== undefined) {
            var checkModal = setInterval(function () {
                var locoModal = $(".loco-modal");
                var locoBatch = locoModal.find("#loco-apis-batch");
                var locoTitle = locoModal.find(".ui-dialog-titlebar .ui-dialog-title");

                if (locoBatch.length && !locoModal.is(":hidden")) {
                    locoModal.removeClass("addtranslations");
                    locoBatch.find("select#auto-api").show();
                    locoBatch.find("a.icon-help, a.icon-group").show();
                    locoBatch.find("#loco-job-progress").show();
                    locoTitle.html("Auto-translate this file");
                    locoBatch.find("button.button-primary span").html("Translate");

                    var opt = locoBatch.find("select#auto-api option").length;

                    if (opt === 1) {
                        locoBatch.find(".noapiadded").remove();
                        locoBatch.removeClass("loco-alert");
                        locoBatch.find("form").hide();
                        locoBatch.addClass("loco-alert");
                        locoTitle.html("No translation APIs configured");
                        locoBatch.append(`<div class='noapiadded'>
                            <p>Add automatic translation services in the plugin settings.<br>or<br>Use <strong>Auto Translate</strong> addon button.</p>
                            <nav>
                                <a href='http://locotranslate.local/wp-admin/admin.php?page=loco-config&amp;action=apis' class='button button-link has-icon icon-cog'>Settings</a>
                                <a href='https://localise.biz/wordpress/plugin/manual/providers' class='button button-link has-icon icon-help' target='_blank'>Help</a>
                                <a href='https://localise.biz/wordpress/translation?l=de-DE' class='button button-link has-icon icon-group' target='_blank'>Need a human?</a>
                            </nav>
                        </div>`);
                    }
                    clearInterval(checkModal);
                }
            }, 100); // check every 100ms
        }
    }
    // filter string based upon type
    function filterRawObject(rawArray, filterType) {
        return rawArray.filter((item) => {
            if (item.source && !item.target) {
                if (ValidURL(item.source) || isHTML(item.source) || isSpecialChars(item.source) || isEmoji(item.source) || item.source.includes('#')) {
                    return false;
                } else if (isPlacehodersChars(item.source)) {
                    return true;
                } else {
                    return true;
                }
            }
            return false;
        });
    }
    // detect String contain URL
    function ValidURL(str) {
        var pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        return pattern.test(str);
    }
    // detect Valid HTML in string
    function isHTML(str) {
        var rgex = /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i;
        return rgex.test(str);
    }
    //  check special chars in string
    function isSpecialChars(str) {
        var rgex = /[@^{}|<>]/g;
        return rgex.test(str);
    }
    //  check Emoji chars in string
    function isEmoji(str) {
        var ranges = [
            '(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])' // U+1F680 to U+1F6FF
        ];
        return str.match(ranges.join('|'));
    }
    // allowed special chars in plain text
    function isPlacehodersChars(str) {
        var rgex = /%s|%d/g;
        return rgex.test(str);
    }
    // replace placeholders in strings
    function strtr(s, p, r) {
        return !!s && {
            2: function () {
                for (var i in p) {
                    s = strtr(s, i, p[i]);
                }
                return s;
            },
            3: function () {
                return s.replace(RegExp(p, 'g'), r);
            },
            0: function () {
                return;
            }
        }[arguments.length]();
    }

    // Save translated strings in the cache using ajax requests in parts.
    function saveTranslatedStrings(translatedStrings, projectId, translationData) {
        // Check if translatedStrings is not empty and has data
        if (translatedStrings && translatedStrings.length > 0) {
            // Define the batch size for ajax requests
            const batchSize = 2500;

            // Iterate over the translatedStrings in batches
            for (let i = 0; i < translatedStrings.length; i += batchSize) {
                // Extract the current batch
                const batch = translatedStrings.slice(i, i + batchSize);
                // Determine the part based on the batch position
                const part = `-part-${Math.ceil(i / batchSize)}`;
                // Send ajax request for the current batch
                sendBatchRequest(batch, projectId, part, translationData);

            }
        }
    }

    // send ajax request and save data.
    function sendBatchRequest(stringData, projectId, part, translationData) {
        const data = {
            'action': 'save_all_translations',
            'data': JSON.stringify(stringData),
            'part': part,
            'project-id': projectId,
            'wpnonce': nonce,
            'translation_data': JSON.stringify(translationData)
        };
        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: data,
            dataType: 'json', // Response data type
            success: function (response) {
                // Handle success
                $('#loco-editor nav button[data-loco="auto"]').trigger("click");
            },
            error: function (xhr, status, error) {
                // Handle error
                console.error(error);
            }
        });
    }

    // integrates auto traslator button in editor
    function addAutoTranslationBtn() {
        // check if button already exists inside translation editor
        const existingBtn = $("#loco-editor nav").find("#cool-auto-translate-btn");
        if (existingBtn.length > 0) {
            existingBtn.remove();
        }
        const locoActions = $("#loco-editor nav").find("#loco-actions");
        const autoTranslateBtn = $('<fieldset><button id="cool-auto-translate-btn" class="button has-icon icon-translate">Auto Translate</button></fieldset>');
        // append custom created button.
        locoActions.append(autoTranslateBtn);
    }
    // open settings model on auto translate button click
    function openSettingsModel() {
        $("#lcat-dialog").dialog({
            dialogClass: rtlClass,
            resizable: false,
            height: "auto",
            width: 400,
            modal: true,
            draggable: false,
            buttons: {
                Cancel: function () {
                    $(this).dialog("close");
                }
            },
        });
    }

    //String Translate Model
    // Get all elements with the class "lcat_custom_model"
    var modals = document.querySelectorAll(".lcat_custom_model");
    // When the user clicks anywhere outside of any modal, close it
    $(window).click(function (event) {
        if (!event.target.closest(".modal-content")) {

        }
        for (var i = 0; i < modals.length; i++) {
            var modal = modals[i];
            if ($(event.target).hasClass("lcat_custom_model") && event.target === modal) {
                modal.style.display = "none";
                if ($(".container").length > 0) {
                    $(".container").remove();
                }
            }
        }
    });

    // Get the <span> element that closes the modal
    $(".lcat_custom_model").find(".close").on("click", function () {

        if ($(".container").length > 0) {
            // If it exists, remove it
            $(".container").remove();
        }
        $(".lcat_custom_model").fadeOut("slow");

    });

    function encodeHtmlEntity(str) {
        var buf = [];
        for (var i = str.length - 1; i >= 0; i--) {
            buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
        }
        return buf.join('');
    }

    // get object and append inside the popup
    function printStringsInPopup(jsonObj, type) {
        let html = '';
        let totalTChars = 0;
        let index = 1;
        let custom_attr = '';
        if (jsonObj) {
            for (const key in jsonObj) {
                if (jsonObj.hasOwnProperty(key)) {
                    const element = jsonObj[key];
                    const sourceText = element.source.trim();

                    if (sourceText !== '') {
                        if (type == "ChromeAiTranslator") {
                            html += `<tr id="${key}"><td>${index}</td><td class="notranslate source">${encodeHtmlEntity(sourceText)}</td>`;

                            if (type == "ChromeAiTranslator") {

                                html += `<td   ${custom_attr}  class="target translate">${sourceText}</td></tr>`;

                            } else {
                                html += '<td class="target translate"></td></tr>';
                            }

                            const div = document.createElement('div');
                            div.innerHTML = sourceText;

                            index++;
                            totalTChars += div.innerText.length;
                        }
                    }
                }
            }

            $(".lcat_stats").each(function () {
                $(this).find(".totalChars").html(totalTChars);
            });
        }

        $("#" + type + '-widget-model').find(".lcat_strings_table > tbody.lcat_strings_body").html(html);

    }

    function settingsModel() {
        const icons = {

            chrome: extradata['chromeAi_preview'],
            docs: extradata['document_preview'],
            error: extradata['error_preview']
        };



        const url = 'https://locoaddon.com/docs/';
        const LCAT_IMG = (key) => LCAT_URL + 'assets/images/' + icons[key];
        const DOC_ICON_IMG = `<img src="${LCAT_IMG('docs')}" width="20" alt="Docs">`;



        const rows = [

            {
                name: 'Chrome Built-in AI',
                icon: 'chrome',
                info: 'https://developer.chrome.com/docs/ai/translator-api',
                doc: `https://developer.chrome.com/docs/ai/translator-api`,
                btn: `
                    <button id="ChromeAiTranslator_settings_btn" class="lcat-provider-btn translate">Translate</button>
                    <button id="lcat-chromeai-disabled-message" class="lcat-provider-btn error d-none">
                        <img src="${LCAT_IMG('error')}" alt="error" style="height:16px; vertical-align:middle; margin-right:5px;">
                        View Error
                    </button>
                    <div id="lcat-chromeai-disabled-message-content" style="display:none;"></div>
                `
            }
        ];

        const rowHTML = rows.map(row => `
            <tr>
                <td class="lcat-provider-name">
                    <a href="${row.info}" target="_blank">
                        <img src="${LCAT_IMG(row.icon)}" class="lcat-provider-icon" alt="${row.name}">
                    </a>
                    ${row.name}
                </td>
                <td>${row.btn}</td>
                 <td>
                    <a href="${row.doc}" target="_blank" class="lcat-provider-docs-btn">${DOC_ICON_IMG}</a>
                </td>
               
            </tr>
        `).join('');

        const modelHTML = `
            <div class="lcat-provider-modal" id="lcat-dialog" title="Step 2 - Select Translation Provider" style="display:none;">
                <table class="lcat-provider-table">
                    <thead>
                        <tr><th>Name</th><th>Translate</th><th>Docs</th></tr>
                    </thead>
                    <tbody>${rowHTML}</tbody>
                </table>
            </div>
        `;

        $("body").append(modelHTML);
    }


    // modal to show strings
    function createStringsModal(projectId, widgetType) {
        // Set wrapper, header, and body classes based on widgetType
        let { wrapperCls, headerCls, bodyCls, footerCls, modelId } = getWidgetClasses(widgetType);

        let modelHTML = `
            <div id="${modelId}" class="modal lcat_custom_model  ${wrapperCls} ${rtlClass}">
                <div class="modal-content">
                    <input type="hidden" id="project_id" value="${projectId}"> 
                    ${modelHeaderHTML(widgetType, headerCls)}   
                    ${modelBodyHTML(widgetType, bodyCls)}   
                    ${modelFooterHTML(widgetType, footerCls)} 
                    </div>
                </div>`;

        $("body").append(modelHTML);
    }

    // Get widget classes based on widgetType
    function getWidgetClasses(widgetType) {
        let wrapperCls = '';
        let headerCls = '';
        let bodyCls = '';
        let footerCls = '';
        let modelId = '';
        switch (widgetType) {
            case 'ChromeAiTranslator':
                wrapperCls = 'ChromeAiTranslator-widget-container';
                headerCls = 'ChromeAiTranslator-widget-header';
                bodyCls = 'ChromeAiTranslator-widget-body';
                footerCls = 'ChromeAiTranslator-widget-footer';
                modelId = 'ChromeAiTranslator-widget-model';
                type = 'ChromeAiTranslator';
                break;
            default:
                // Default class if widgetType doesn't match any case
                wrapperCls = 'ChromeAiTranslator-widget-container';
                headerCls = 'ChromeAiTranslator-widget-header';
                bodyCls = 'ChromeAiTranslator-widget-body';
                footerCls = 'ChromeAiTranslator-widget-footer';
                break;
        }
        return { wrapperCls, headerCls, bodyCls, footerCls, modelId, type };
    }
    function modelBodyHTML(widgetType, bodyCls) {
        const translator_type = `${type}`;
        const capitalizedString = capitalizeFirstLetter(translator_type);
        function capitalizeFirstLetter(str) {
            str = str.replace('ChromeAiTranslator', 'Chrome AI');
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
        const HTML = `<div class = "modal-scrollbar">
        <div class="notice inline notice-info is-dismissible">
                        Plugin will not translate any strings with HTML or special characters because ${capitalizedString} Translator currently does not support HTML and special characters translations.
                        You can edit translated strings inside Loco Translate Editor after merging the translations. Only special characters (%s, %d) fixed at the time of merging of the translations.
                    </div>
                    <div class="notice inline notice-info is-dismissible">
                        Machine translations are not 100% correct.
                        Please verify strings before using on the production website.
                    </div>
        <div class="modal-body  ${bodyCls}">
            <div class="lcat_translate_progress">
                Automatic translation is in progress....<br/>
                It will take a few minutes, enjoy ☕ coffee in this time!<br/><br/>
                Please do not leave this window or browser tab while the translation is in progress...

            <div class="progress-wrapper">
                <div class="progress-container">
                    <div class="progress-bar" id="myProgressBar">
                        <span id="progressText">0%</span>
                    </div>
                </div>
            </div>
            </div>
            <div class="lcat_translate_warning-massage">
                <div class="warning-massage-wrapper">
                     <button class="close-button">&times;</button>
                     <div class="warning-massage-content"></div>
                </div>
            </div>
            ${translatorWidget(widgetType)}
            <div class="lcat_string_container">
                <table class="scrolldown lcat_strings_table">
                    <thead>
                        <th class="notranslate">S.No</th>
                        <th class="notranslate">Source Text</th>
                        <th class="notranslate">Translation</th>
                    </thead>
                    <tbody class="lcat_strings_body">
                    </tbody>
                </table>
            </div>
            <div class="notice-container"></div>
        </div>
        </div>`;
        return HTML;
    }

    function modelHeaderHTML(widgetType, headerCls) {
        if (widgetType === "ChromeAiTranslator") {
            const HTML = `
        <div class="modal-header  ${headerCls}">
                        <span class="close">&times;</span>
                        <h2 class="notranslate">Step 2 - Start Automatic Translation Process</h2>
                        <div class="lcat_actions">
                            <button class="notranslate lcat_save_strings button button-primary" data-type = "${type}" disabled="true">Merge Translation</button>
                        </div>
                        <div style="display:none" class="lcat_stats hidden">
                            Wahooo! You have saved your valuable time via auto translating 
                            <strong class="totalChars"></strong> characters  using 
                            <strong>
                                
                                    LocoAI – Chrome AI Auto Translator
                               
                            </strong>
                        </div>
                    </div>
                    `;
            return HTML;
        }

    }
    function modelFooterHTML(widgetType, footerCls) {

        if (widgetType === "ChromeAiTranslator") {
            const HTML = ` <div class="modal-footer ${footerCls}">
        <div class="lcat_actions">
            <button class="notranslate lcat_save_strings button button-primary" data-type = "${type}" disabled="true">Merge Translation</button>
        </div>
        <div style="display:none" class="lcat_stats">
            Wahooo! You have saved your valuable time via auto translating 
            <strong class="totalChars"></strong> characters  using 
            <strong>
               
                   LocoAI – Chrome AI Auto Translator
              
            </strong>
        </div>
    </div>`;
            return HTML;
        } else {
            return '';
        }
    }

    // Translator widget HTML
    function translatorWidget(widgetType) {
        if (widgetType === "ChromeAiTranslator") {
            return `<div class="translator-widget  ${widgetType}">
                    <h3 class="choose-lang">Translate Using Chrome Built-in AI<div class="lcat_chrome_ai"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="none" stroke="#5cb85c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m10 7l-.516 1.394c-.676 1.828-1.014 2.742-1.681 3.409s-1.581 1.005-3.409 1.681L3 14l1.394.516c1.828.676 2.742 1.015 3.409 1.681s1.005 1.581 1.681 3.409L10 21l.516-1.394c.676-1.828 1.015-2.742 1.681-3.409s1.581-1.005 3.409-1.681L17 14l-1.394-.516c-1.828-.676-2.742-1.014-3.409-1.681s-1.005-1.581-1.681-3.409zm8-4l-.221.597c-.29.784-.435 1.176-.72 1.461c-.286.286-.678.431-1.462.72L15 6l.598.221c.783.29 1.175.435 1.46.72c.286.286.431.678.72 1.462L18 9l.221-.597c.29-.784.435-1.176.72-1.461c.286-.286.678-.431 1.462-.72L21 6l-.598-.221c-.783-.29-1.175-.435-1.46-.72c-.286-.286-.431-.678-.72-1.462z" color="#5cb85c"/></svg></div></h3>
                     <div id="chrome_ai_translator_element"></div>
                </div>`;
        } else {
            return '';
        }
    }
    // oninit
    $(document).ready(function () {
        initialize();
    });

})(window, jQuery);


