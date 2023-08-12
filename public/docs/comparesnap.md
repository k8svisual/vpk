<topicKey comparesnap/>
<topicBack id="topicNext" link="gettingstarted"/>
<topicNext id="topicBack" link="ownerref"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

###### Compare Snapshots

---
  
Compare two snapshots for difference or matching defined resources.  Comparison is performed checking the following:

* Resource name within namespace. If no namespace is defined the comparison is performed with all resources defined at the cluster level.  
* Creation timestamp.  
* Spec section of resource file.  
  


###### Usage:

1. Select the two snapshots to compare using the buttons labeled **'Snapshot 1'** and **'Snapshot 2'**.  Once selected each  snapshot name is shown below the buttons.  If the same snapshot is selected for both snapshots this is not considered an error; this will result in 100% matching results.

2. Select sort order of output to be viewed using the drop downs labeled **'First by'** and **'Second by'**.  If both buttons have the same values the default sort order of first: Namespace and, second: Name, will be used.

3. Select **View Results** using the drop down.  Options are: All, Matching, and Non-matching.

4. Compare the snapshots by pressing the button labeled **'Compare snapshots'**.  Once processing has completed the results are displayed in a scrollable table.   



###### Viewing results:

Assuming the 'All' option has been selected for View Results.  Six columns of information are displayed:

| Column | Description |
|---|---|
| Namespace | The defined namespace for the resource.  If no namespace is defined the value 'clusterLevel' is displayed. |
| Name | The name of the resource. |
| Kind | An icon and type for the defined kind. |
| Snapshot | Column indicates if the named resource is defined in both of the selected snapshots.  Values are: (a) Both, (b) Snap 1 Only, and (c) Snap 2 Only. |
| CreateTime | Column indicates if the resource 'creationTimestamp' value is the same for the resource.  Valid values are (a) Y or (b) N.  See NOTE 1. |  
| Spec Match | Column indicates if the resource 'spec' sections for the resources match.  Valid values are (a) Y or (b) N.  See NOTE 1. |         

<br>

Example output - 

<br>

<img style="float: center;" src="docs/docimages/compareResults.png" width="1000" height="492">

<br><br>

**NOTE 1:** If the compared values for 'creationTimestamp' and 'spec' are missing in both of the compared snapshot files, this will be considered a match.  Since the values are missing in both files, the display for the appropriate column(s) will be the value 'Y'.

Clicking the icon in the Kind column will display the K8 Explain data for the selected icon.  

When the 'Matching' or 'Non-matching' options of the View Results drop down are selected the displayed rows in the output section are filtered accordingly.   

Clicking the values for Name or Namespace in any displayed line will open a modal screen with the contents of the files shown side-by-side that were compared.  

If the resource does not exist in both snapshots there will only be one file shown in the sid-by-side display.  In the display the missing file will be identified with a box outlined in red with a question mark inside the box with the text '(No matching file)' shown alondside the box.

<br>

Side-by-Side output - 

<br>

<img style="float: center;" src="docs/docimages/compareSideBySide.png" width="1000" height="690">

<br><br>


---

No video available at this time.

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/EqknUXaIRnk">
    </iframe>
</div> -->

---



<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>
